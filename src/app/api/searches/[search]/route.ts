import axios from 'axios';
import iconv from 'iconv-lite';
import {JSDOM} from 'jsdom';
import {NextResponse} from "next/server";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";
import {getZamundaBaseUrlFromCookieHeader} from "@/lib/zamundaBaseUrl";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

const toAbsoluteUrl = (value: unknown, baseUrl: string): string => {
	if (typeof value !== "string" || !value.trim()) return "";
	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return "";
	}
};

const pickFirstString = (item: Record<string, unknown>, keys: string[]): string => {
	for (const key of keys) {
		const value = item[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return "";
};

const pickFirstNumberLikeString = (item: Record<string, unknown>, keys: string[]): string => {
	for (const key of keys) {
		const value = item[key];
		if (typeof value === "number") return String(value);
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
};

const extractCollection = (payload: unknown): Record<string, unknown>[] => {
	if (Array.isArray(payload)) {
		return payload.filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null);
	}
	if (!payload || typeof payload !== "object") {
		return [];
	}
	const root = payload as Record<string, unknown>;
	const candidates = ["data", "items", "results", "torrents"];
	for (const key of candidates) {
		const value = root[key];
		if (Array.isArray(value)) {
			return value.filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null);
		}
	}
	return [];
};

const extractPages = (payload: unknown, fallback: number): number => {
	if (!payload || typeof payload !== "object") {
		return fallback;
	}
	const root = payload as Record<string, unknown>;
	const directKeys = ["pages", "total_pages", "last_page", "totalPages"];
	for (const key of directKeys) {
		const value = root[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
	}

	const nestedContainers = ["meta", "pagination"];
	for (const container of nestedContainers) {
		const value = root[container];
		if (!value || typeof value !== "object") continue;
		const nested = value as Record<string, unknown>;
		for (const key of directKeys) {
			const nestedValue = nested[key];
			if (typeof nestedValue === "number" && Number.isFinite(nestedValue)) return nestedValue;
			if (typeof nestedValue === "string" && nestedValue.trim() && !Number.isNaN(Number(nestedValue))) return Number(nestedValue);
		}
	}

	return fallback;
};

export async function GET(req: Request, context: { params: Promise<{ search: string }> }) {
	try {
		const {searchParams} = new URL(req.url);
		const baseUrl = getZamundaBaseUrlFromCookieHeader(req.headers.get('cookie'));
		const {search} = await context.params;
		const page = searchParams.get('page');
		console.log(decodeURIComponent(search));

		if (baseUrl === "https://zamunda.rip") {
			const query = decodeURIComponent(search);
			const ripUrl = new URL(`${baseUrl}/api/torrents`);
			ripUrl.searchParams.set("q", query);
			if (page && !Number.isNaN(Number(page))) {
				ripUrl.searchParams.set("page", String(Number(page) + 1));
			}

			const response = await client.get(ripUrl.toString(), {
				withCredentials: true,
			});

			const items = extractCollection(response.data);
			const parsedData = items.map((item) => {
				const rawLink = pickFirstString(item, [
					"magnet",
					"magnet_url",
					"magnetUrl",
					"download",
					"download_url",
					"downloadUrl",
					"torrent",
					"torrent_url",
					"url",
					"link",
				]);
				const resolvedLink = rawLink ? toAbsoluteUrl(rawLink, baseUrl) : "";
				const finalLink = resolvedLink || rawLink;

				return {
					name: pickFirstString(item, ["name", "title", "torrent_name", "release"]) || "Unknown",
					link: finalLink,
					image: toAbsoluteUrl(
						pickFirstString(item, ["image", "poster", "cover", "thumbnail", "thumb", "image_url"]),
						baseUrl
					),
					size: pickFirstNumberLikeString(item, ["size", "size_text", "size_human"]),
					downloaded: pickFirstNumberLikeString(item, ["downloads", "downloaded", "completed"]),
					seed: pickFirstNumberLikeString(item, ["seed", "seeds", "seeders"]),
					icon1: "",
					icon2: "",
				};
			}).filter((item) => Boolean(item.link));

			const pages = extractPages(response.data, parsedData.length > 0 ? 1 : 0);
			return NextResponse.json(
				{
					tableData: parsedData,
					pages,
				},
				{status: 200}
			);
		}

		const url = `${baseUrl}/bananas?c5=1&c19=1&c20=1&c24=1&c25=1&c28=1&c31=1&c35=1&c42=1&c46=1&c7=1&c33=1&c55=1&search=${(decodeURIComponent(search).replace(/\s/g, '+'))}&gotonext=1&incldead=&field=name${page && ('&page=' + page) || ''}`;
		const cookies = req.headers.get('cookie');
		if (cookies) {
			cookies.split(';').forEach(cookie => {
				cookieJar.setCookie(cookie, baseUrl);
			});
		}
		const response = await client.get(url, {
			withCredentials: true,
			responseType: 'arraybuffer',
		});

		const decodedData = iconv.decode(response.data, 'win1251');
		const dom = new JSDOM(decodedData);

		const document = dom.window.document;

		const parsedData = [...document.querySelectorAll('tr>td>a>b')].map((el) => {
			const parentRow = el?.parentElement?.parentElement;
			const anchorElement = parentRow?.querySelector('.imdrating div a') as HTMLAnchorElement | null;
			const onMouseOverAttr = el?.parentElement?.getAttribute('onmouseover');
			const imageSrcMatch = onMouseOverAttr?.match(/src*=\\*'(.+?)'/g);
			const imageSrc = imageSrcMatch ? imageSrcMatch[0].replace(`src=\\'`, '').replace(`\\'`, '') : '';

			const icon1Element = el?.parentElement?.nextElementSibling as HTMLImageElement | null;
			const icon2Element = el?.parentElement?.nextElementSibling?.nextElementSibling as HTMLImageElement | null;

			return {
				name: el?.innerHTML || '',
				link: anchorElement ? new URL(anchorElement.href, baseUrl).toString() : '',
				image: imageSrc ? new URL(imageSrc, baseUrl).toString() : '',
				size: parentRow?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.innerHTML?.replace('<br>', ' ') || '', // Fallback to empty string
				downloaded: parentRow?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.innerHTML?.replace('<br>', ' ') || '', // Fallback to empty string
				seed: parentRow?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.nextElementSibling?.querySelector('font, span')?.innerHTML?.replace('<br>', ' ') || '', // Fallback to empty string
				icon1: icon1Element?.src || '',
				icon2: icon2Element?.src || '',
			};
		});
		const pagesElement = [...document.querySelectorAll('font.red a b')].pop();
		const pages = pagesElement
			? Math.round(Number(pagesElement.innerHTML.replace(/&nbsp;/g, '').split('-')[1]) / 20)
			: 0;
		return NextResponse.json(
			{
				tableData: parsedData,
				pages: pages,
			},
			{status: 200}
		);

	} catch (error) {
		console.error('Error fetching data:', error);
		return NextResponse.json({error: 'Failed to fetch data'}, {status: 500});
	}
}


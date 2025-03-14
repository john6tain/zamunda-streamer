import axios from 'axios';
import iconv from 'iconv-lite';
import {JSDOM} from 'jsdom';
import {NextResponse} from "next/server";
import {CookieJar} from "tough-cookie";
import {wrapper} from "axios-cookiejar-support";

const cookieJar = new CookieJar();
const client = wrapper(axios.create({jar: cookieJar, withCredentials: true}));

export async function GET(req: Request, context: { params: Promise<{ search: string }> }) {
	try {
		const {searchParams} = new URL(req.url);
		const {search} = await context.params;
		const page = searchParams.get('page');
		console.log(decodeURIComponent(search));
		const url = `https://www.zamunda.net/bananas?c5=1&c19=1&c20=1&c24=1&c25=1&c28=1&c31=1&c35=1&c42=1&c46=1&c7=1&c33=1&c55=1&search=${(decodeURIComponent(search).replace(/\s/g, '+'))}&gotonext=1&incldead=&field=name${page && ('&page=' + page) || ''}`;
		const cookies = req.headers.get('cookie');
		if (cookies) {
			cookies.split(';').forEach(cookie => {
				cookieJar.setCookie(cookie, 'https://www.zamunda.net');
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
				link: anchorElement ? 'https://www.zamunda.net' + anchorElement.href : '',
				image: 'https://www.zamunda.net' + imageSrc,
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


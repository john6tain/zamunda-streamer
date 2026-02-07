import {NextRequest, NextResponse} from "next/server";

function isAllowedProtocol(url: URL): boolean {
	return url.protocol === "http:" || url.protocol === "https:";
}

export async function GET(req: NextRequest) {
	const {searchParams} = new URL(req.url);
	const rawUrl = searchParams.get("url");

	if (!rawUrl) {
		return NextResponse.json({error: "Missing url"}, {status: 400});
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawUrl);
	} catch {
		return NextResponse.json({error: "Invalid url"}, {status: 400});
	}

	if (!isAllowedProtocol(targetUrl)) {
		return NextResponse.json({error: "Unsupported protocol"}, {status: 400});
	}

	try {
		const cookieHeader = req.headers.get("cookie");
		const response = await fetch(targetUrl.toString(), {
			headers: {
				"User-Agent": "zamunda-streamer",
				...(cookieHeader ? {Cookie: cookieHeader} : {}),
			},
			next: {revalidate: 60},
		});

		if (!response.ok) {
			return NextResponse.json({error: "Failed to fetch image"}, {status: response.status});
		}

		const contentType = response.headers.get("content-type") || "application/octet-stream";
		const buffer = await response.arrayBuffer();

		return new NextResponse(buffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch {
		return NextResponse.json({error: "Failed to fetch image"}, {status: 500});
	}
}

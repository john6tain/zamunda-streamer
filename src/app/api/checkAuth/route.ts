import { NextResponse } from 'next/server';
import { getZamundaBaseUrlFromCookieHeader, isPublicZamundaBaseUrl } from '@/lib/zamundaBaseUrl';

export async function GET(req: Request) {
	const cookies = req.headers.get('cookie');
	const baseUrl = getZamundaBaseUrlFromCookieHeader(cookies);

	const hasUid = Boolean(cookies?.match(/(?:^|;\s*)uid=/));
	const hasPass = Boolean(cookies?.match(/(?:^|;\s*)pass=/));
	const hasDirectSource = Boolean(cookies?.match(/(?:^|;\s*)direct_torrent_url=/));
	const isAuthenticated = hasUid && hasPass;
	const isPublicMode = isPublicZamundaBaseUrl(baseUrl);

	if (isAuthenticated) {
		return NextResponse.json({ authenticated: true, mode: 'auth' });
	}
	if (hasDirectSource) {
		return NextResponse.json({ authenticated: true, mode: 'direct' });
	}
	if (isPublicMode) {
		return NextResponse.json({ authenticated: true, mode: 'public' });
	}
	return NextResponse.json({ authenticated: false, mode: 'none' });
}

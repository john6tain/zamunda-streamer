import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicZamundaBaseUrl } from '@/lib/zamundaBaseUrl';

export function middleware(req: NextRequest) {
	const hasAuthCookies = req.cookies.has('uid') && req.cookies.has('pass');
	const hasDirectSource = req.cookies.has('direct_torrent_url');
	const baseUrlCookie = req.cookies.get('zamunda_base_url')?.value;
	const hasPublicBaseUrl = isPublicZamundaBaseUrl(baseUrlCookie);
	const hasAccess = hasAuthCookies || hasDirectSource || hasPublicBaseUrl;

	if ((hasAuthCookies || hasPublicBaseUrl) && req.nextUrl.pathname === '/login') {
		return NextResponse.redirect(new URL('/dashboard', req.url));
	}

	if (!hasAccess && req.nextUrl.pathname.startsWith('/dashboard')) {
		return NextResponse.redirect(new URL('/login', req.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/dashboard/:path*', '/login'],
};

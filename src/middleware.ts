import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
	// Check if required authentication cookies are present
	const hasAuthCookies = req.cookies.has('uid') && req.cookies.has('pass');

	// If authenticated and trying to access login, redirect to dashboard
	if (hasAuthCookies && req.nextUrl.pathname === '/login') {
		return NextResponse.redirect(new URL('/dashboard', req.url));
	}

	// If NOT authenticated and trying to access dashboard, redirect to login
	if (!hasAuthCookies && req.nextUrl.pathname.startsWith('/dashboard')) {
		return NextResponse.redirect(new URL('/login', req.url));
	}

	return NextResponse.next(); // Allow other requests to continue
}

// 🔥 Apply middleware to `/dashboard` and `/login`
export const config = {
	matcher: ['/dashboard/:path*', '/login'],
};

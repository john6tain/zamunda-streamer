export type StreamBackend = 'peerflix' | 'webtorrent';

export const DEFAULT_STREAM_BACKEND: StreamBackend = 'peerflix';

export function normalizeStreamBackend(value?: string | null): StreamBackend {
	return value === 'webtorrent' ? 'webtorrent' : 'peerflix';
}

export function getStreamBackendFromCookieHeader(cookieHeader?: string | null): StreamBackend {
	if (!cookieHeader) {
		return DEFAULT_STREAM_BACKEND;
	}
	const match = cookieHeader.match(/(?:^|;\s*)stream_backend=([^;]+)/);
	const rawValue = match ? decodeURIComponent(match[1]) : '';
	return normalizeStreamBackend(rawValue);
}

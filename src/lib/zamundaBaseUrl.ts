export const DEFAULT_ZAMUNDA_BASE_URL = 'https://www.zamunda.net';

export function normalizeZamundaBaseUrl(input?: string | null): string {
	if (!input) {
		return DEFAULT_ZAMUNDA_BASE_URL;
	}
	try {
		const url = new URL(input);
		return url.origin;
	} catch {
		return DEFAULT_ZAMUNDA_BASE_URL;
	}
}

export function getZamundaBaseUrlFromCookieHeader(cookieHeader?: string | null): string {
	if (!cookieHeader) {
		return DEFAULT_ZAMUNDA_BASE_URL;
	}
	const match = cookieHeader.match(/(?:^|;\s*)zamunda_base_url=([^;]+)/);
	const rawValue = match ? decodeURIComponent(match[1]) : '';
	return normalizeZamundaBaseUrl(rawValue);
}

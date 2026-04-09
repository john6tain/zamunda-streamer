export const DEFAULT_ZAMUNDA_BASE_URL = 'https://www.zamunda.net';
export const PUBLIC_ZAMUNDA_BASE_URLS = ['https://zamunda.rip'];

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

export function isPublicZamundaBaseUrl(input?: string | null): boolean {
	const normalized = normalizeZamundaBaseUrl(input);
	return PUBLIC_ZAMUNDA_BASE_URLS.includes(normalized);
}

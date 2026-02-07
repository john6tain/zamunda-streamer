declare module "js-cookie" {
	interface CookieAttributes {
		path?: string;
		domain?: string;
		expires?: number | Date;
		secure?: boolean;
		sameSite?: "lax" | "strict" | "none";
	}

	interface CookiesStatic {
		get(name: string): string | undefined;
		set(name: string, value: string, options?: CookieAttributes): void;
		remove(name: string, options?: CookieAttributes): void;
	}

	const Cookies: CookiesStatic;
	export default Cookies;
}

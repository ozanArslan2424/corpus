function parseCookieHeader(cookieHeader: string): Array<Bun.Cookie> {
	const array: Array<Bun.Cookie> = [];

	const pairs = cookieHeader.matchAll(/([^=;\s]+)=([^;]*)/g);
	for (const [, name, value] of pairs) {
		if (!name) continue;
		array.push(Bun.Cookie.parse(`${name}=${value}`));
	}

	return array;
}

function parseSetCookieHeaders(headers: string[]): Array<Bun.Cookie> {
	const array: Array<Bun.Cookie> = [];
	for (const header of headers) {
		array.push(Bun.Cookie.parse(header));
	}
	return array;
}

class Cookies extends Bun.CookieMap {
	constructor(...args: ConstructorParameters<typeof Bun.CookieMap>) {
		super(...args);
		// Bun.CookieMap is native and ignores new.target.
		// Reattach the subclass prototype.
		Object.setPrototypeOf(this, new.target.prototype);
	}

	static fromHeader(cookieHeader: string): Cookies {
		const cookies = new Cookies();
		for (const cookie of parseCookieHeader(cookieHeader)) cookies.set(cookie);
		return cookies;
	}

	static fromSetCookieHeaders(headers: string[]): Cookies {
		const cookies = new Cookies();
		for (const cookie of parseSetCookieHeaders(headers)) cookies.set(cookie);
		return cookies;
	}
}

export { Cookies, parseCookieHeader, parseSetCookieHeaders };

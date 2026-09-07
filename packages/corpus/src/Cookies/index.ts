/**
 * Cookie reading and writing, built on Bun's native cookie primitives.
 *
 * {@link Cookies} extends `Bun.CookieMap`, so it keeps the whole native API —
 * `get`, `set`, `delete`, iteration — and adds the two constructions the
 * framework needs: parsing an inbound `Cookie` header and parsing outbound
 * `Set-Cookie` headers back into a map.
 *
 * The two header formats are not interchangeable, which is why they get separate
 * entry points: a `Cookie` header is a list of name/value pairs on one line with
 * no attributes, while each `Set-Cookie` header is a single cookie carrying its
 * own `Path`, `Max-Age`, `HttpOnly` and the rest.
 *
 * @module Cookies
 */

/**
 * Parses an inbound `Cookie` header into individual cookies.
 *
 * The header is a semicolon-separated list of name/value pairs with no
 * attributes, so each pair is re-serialised on its own before being handed to
 * Bun's parser. Malformed fragments that yield no name are skipped rather than
 * throwing — a single bad pair from a client should not fail the request.
 *
 * @param cookieHeader - The raw `Cookie` header value.
 * @returns The parsed cookies, in header order. Values keep whatever encoding
 * the client sent.
 */
function parseCookieHeader(cookieHeader: string): Array<Bun.Cookie> {
	const array: Array<Bun.Cookie> = [];
	const pairs = cookieHeader.matchAll(/([^=;\s]+)=([^;]*)/g);
	for (const [, name, value] of pairs) {
		if (!name) continue;
		array.push(Bun.Cookie.parse(`${name}=${value}`));
	}
	return array;
}

/**
 * Parses `Set-Cookie` header values into individual cookies, attributes
 * included.
 *
 * Each header carries exactly one cookie, so no splitting is needed — unlike
 * {@link parseCookieHeader}, which has to break one header into many pairs.
 *
 * @param headers - The raw `Set-Cookie` header values, one per cookie. Use
 * `Headers.getSetCookie()` to obtain them; a plain `get` collapses repeated
 * headers into one string and loses the boundaries.
 * @returns The parsed cookies, in the order given.
 */
function parseSetCookieHeaders(headers: string[]): Array<Bun.Cookie> {
	const array: Array<Bun.Cookie> = [];
	for (const header of headers) {
		array.push(Bun.Cookie.parse(header));
	}
	return array;
}

/**
 * A cookie map with header-parsing constructors.
 *
 * Everything `Bun.CookieMap` offers is available unchanged; the two static
 * methods are the additions. Use {@link Cookies.fromHeader} for what a client
 * sent and {@link Cookies.fromSetCookieHeaders} for what a server is sending
 * back — reading a response's own cookies, or following them in a client.
 */
class Cookies extends Bun.CookieMap {
	/**
	 * Creates a cookie map, forwarding to the native constructor.
	 *
	 * `Bun.CookieMap` is a native class that ignores `new.target`, so instances
	 * come back with the base prototype and none of the subclass members attached.
	 * The prototype is reattached here, which is what makes subclassing work at
	 * all.
	 *
	 * @param args - The native {@link Bun.CookieMap} constructor arguments.
	 */
	constructor(...args: ConstructorParameters<typeof Bun.CookieMap>) {
		super(...args);
		// Bun.CookieMap is native and ignores new.target.
		// Reattach the subclass prototype.
		Object.setPrototypeOf(this, new.target.prototype);
	}

	/**
	 * Builds a map from an inbound `Cookie` header.
	 *
	 * @param cookieHeader - The raw `Cookie` header value, as sent by the client.
	 * @returns The cookies it carried. Repeated names resolve to the last
	 * occurrence.
	 */
	static fromHeader(cookieHeader: string): Cookies {
		const cookies = new Cookies();
		for (const cookie of parseCookieHeader(cookieHeader)) cookies.set(cookie);
		return cookies;
	}

	/**
	 * Builds a map from outbound `Set-Cookie` headers, preserving each cookie's
	 * attributes.
	 *
	 * @param headers - The raw `Set-Cookie` values, one per cookie.
	 * @returns The cookies they describe. Repeated names resolve to the last
	 * occurrence.
	 */
	static fromSetCookieHeaders(headers: string[]): Cookies {
		const cookies = new Cookies();
		for (const cookie of parseSetCookieHeaders(headers)) cookies.set(cookie);
		return cookies;
	}
}

export { Cookies, parseCookieHeader, parseSetCookieHeaders };

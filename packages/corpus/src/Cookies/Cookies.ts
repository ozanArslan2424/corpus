import type { CookieOptions, CookiesInit } from "@/Cookies/types";

/**
 * Manages a collection of HTTP cookies for a request or response.
 *
 * Provides a unified API for reading, writing, and serializing cookies.
 */
export class Cookies {
	constructor(init?: CookiesInit | Cookies) {
		if (init instanceof Cookies) {
			for (const name of init.keys()) {
				const value = init.get(name) ?? "";
				this.set({ name, value });
			}
		} else if (Array.isArray(init)) {
			for (const opts of init) {
				this.set(opts);
			}
		} else if (init && "name" in init && "value" in init) {
			this.set(init);
		}
	}

	protected map = new Bun.CookieMap();

	/**
	 * Serializes the collection to an array of `Set-Cookie` header strings.
	 *
	 * Each entry corresponds to a single cookie and is suitable for use as the
	 * value of a `Set-Cookie` response header.
	 *
	 * @returns An array of `Set-Cookie` header values.
	 */
	toSetCookieHeaders(): Array<string> {
		return this.map.toSetCookieHeaders();
	}

	/**
	 * Sets a cookie with the given options.
	 *
	 * If a cookie with the same name already exists, it is overwritten.
	 *
	 * @param opts - The cookie name, value, and attributes (path, domain, expires, etc.).
	 */
	set(opts: CookieOptions): void {
		this.map.set(opts.name, opts.value, opts);
	}

	/**
	 * Sets multiple cookies in a single call.
	 *
	 * Equivalent to calling {@link set} for each entry in the array.
	 *
	 * @param optsArr - An array of cookie option objects.
	 */
	setMany(optsArr: Array<CookieOptions>): void {
		for (const opts of optsArr) {
			this.set(opts);
		}
	}

	/**
	 * Retrieves the value of a cookie by name.
	 *
	 * @param name - The cookie name.
	 * @returns The cookie value, or `null` if no cookie with that name exists.
	 */
	get(name: string): string | null {
		return this.map.get(name);
	}

	/**
	 * Checks whether a cookie with the given name exists.
	 *
	 * @param name - The cookie name.
	 * @returns `true` if the cookie is present, `false` otherwise.
	 */
	has(name: string): boolean {
		return this.map.has(name);
	}

	/**
	 * The number of cookies currently in the collection.
	 */
	get count(): number {
		return this.values().length;
	}

	/**
	 * Removes a cookie from the collection by name.
	 *
	 * Note: this only removes the cookie from this collection. To instruct the
	 * client to delete a cookie, set one with an expired `expires` date or a
	 * `maxAge` of `0`.
	 *
	 * @param name - The cookie name.
	 */
	delete(name: string): void {
		this.map.delete(name);
	}

	/**
	 * Returns an iterator over the cookie name/value pairs.
	 *
	 * @returns An iterator yielding `[name, value]` tuples.
	 */
	entries(): IterableIterator<[string, string]> {
		return this.map.entries();
	}

	/**
	 * Returns all cookie values in the collection.
	 *
	 * @returns An array of cookie values.
	 */
	values(): Array<string> {
		return Array.from(this.map.values());
	}

	/**
	 * Returns all cookie names in the collection.
	 *
	 * @returns An array of cookie names.
	 */
	keys(): Array<string> {
		return Array.from(this.map.keys());
	}
}

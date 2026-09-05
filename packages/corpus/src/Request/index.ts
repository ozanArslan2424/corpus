import { Cookies, parseCookieHeader } from "@/Cookies";
import { readHeader, HeaderKey } from "@/Headers";
import { enumerate, type ValueOf } from "@/utils/enum";
import type { OrString } from "@/utils/lexical";
import { createSafeObject } from "@/utils/object";
import { lazy, type LazyMut } from "@/utils/variable";

declare global {
	interface RequestInit {
		cookies?: Cookies;
	}

	interface Request {
		params: { [x: string]: string };
		cookies: Cookies;
	}
}

interface WithPrivates extends Request {
	_cookies: LazyMut<Cookies>;
}

/** Commonly used HTTP verbs. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) for the full spec. */
const Method = enumerate({
	/** Retrieve a resource from the server. */
	GET: "GET",
	/** Submit data to create a new resource. */
	POST: "POST",
	/** Replace an entire resource with new data. */
	PUT: "PUT",
	/** Apply partial modifications to a resource. */
	PATCH: "PATCH",
	/** Remove a resource from the server. */
	DELETE: "DELETE",
	/** Get response headers without body. */
	HEAD: "HEAD",
	/** Discover communication options. */
	OPTIONS: "OPTIONS",
	/** Establish tunnel to server. */
	CONNECT: "CONNECT",
	/** Echo back received request. */
	TRACE: "TRACE",
});

type Method = OrString<ValueOf<typeof Method>>;

function requestCookiesFactory(init?: RequestInit): LazyMut<Cookies> {
	return lazy.mut(() => {
		const cookies = init?.cookies ?? new Cookies();

		const cookieHeader = readHeader(init?.headers, HeaderKey.Cookie);
		if (!cookieHeader) return cookies;

		for (const cookie of parseCookieHeader(cookieHeader)) {
			cookies.set(cookie);
		}

		return cookies;
	});
}

function patchGlobalRequest() {
	const NativeRequest = globalThis.Request;

	// For Request objects constructed with Bun
	Object.defineProperties(Request.prototype, {
		params: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: createSafeObject(),
		},
		_cookies: {
			configurable: true,
			enumerable: false,
			writable: true,
			value: undefined,
		},
		cookies: {
			configurable: true,
			enumerable: false,
			get(this: WithPrivates) {
				if (!this._cookies) {
					this._cookies = requestCookiesFactory({ headers: this.headers });
				}
				return this._cookies();
			},
			set(this: WithPrivates, value: Cookies) {
				if (!this._cookies) {
					this._cookies = requestCookiesFactory({ headers: this.headers });
				}
				this._cookies.set(value);
			},
		},
	});

	// For Request objects constructed manually
	globalThis.Request = class extends NativeRequest {
		constructor(input: RequestInfo | URL, init?: RequestInit) {
			super(input, init);
			this._cookies = requestCookiesFactory(init);
		}

		static override [Symbol.hasInstance](value: unknown): boolean {
			return value instanceof NativeRequest;
		}

		override params: { [x: string]: string } = createSafeObject();

		private _cookies: LazyMut<Cookies>;
		override get cookies(): Cookies {
			return this._cookies();
		}
		override set cookies(value: Cookies) {
			this._cookies.set(value);
		}
	};
}

export { Method, patchGlobalRequest };

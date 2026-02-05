import { textIsDefined } from "@/utils/textIsDefined";
import { textAfterMark } from "@/utils/textAfterMark";
import { capitalize } from "@/utils/capitalize";
import type { CoreumCookieOptions } from "@/internal/Cookies/CoreumCookieOptions";
import { CoreumCookies__BunOnly } from "@/internal/Cookies/CoreumCookies__BunOnly";

export class CoreumCookies extends CoreumCookies__BunOnly {
	constructor() {
		super();
	}

	decodeValue(cookieString: string): string | null {
		const encodedValue = textAfterMark("=", cookieString);
		if (!encodedValue) return null;
		return decodeURIComponent(encodedValue);
	}

	static createHeader(opt: CoreumCookieOptions): string {
		let result = `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`;

		if (textIsDefined(opt.domain)) {
			result += `; Domain=${opt.domain}`;
		}

		if (textIsDefined(opt.path)) {
			result += `; Path=${opt.path}`;
		} else {
			result += `; Path=/`;
		}

		if (opt.expires) {
			if (typeof opt.expires === "number") {
				result += `; Expires=${new Date(opt.expires).toUTCString()}`;
			} else {
				result += `; Expires=${opt.expires.toUTCString()}`;
			}
		}

		if (opt.maxAge && Number.isInteger(opt.maxAge)) {
			result += `; Max-Age=${opt.maxAge}`;
		}

		if (opt.secure === true) {
			result += "; Secure";
		}

		if (opt.httpOnly === true) {
			result += "; HttpOnly";
		}

		if (opt.partitioned === true) {
			result += "; Partitioned";
		}

		if (textIsDefined(opt.sameSite)) {
			result += `; SameSite=${capitalize(opt.sameSite)}`;
		} else {
			result += `; SameSite=Lax`;
		}

		return result;
	}
}

// export class Cookies {
// 	constructor() {}
// 	private map = new Map<string, CookieOptions>();
//
// 	set(opts: CookieOptions): void {
// 		this.map.set(opts.name, opts);
// 	}
//
// 	getOptions(key: string): CookieOptions | null {
// 		return this.map.get(key) ?? null;
// 	}
//
// 	get(key: string): string | null {
// 		const cookie = this.map.get(key);
// 		if (!cookie) return null;
// 		return cookie.value;
// 	}
//
// 	has(key: string): boolean {
// 		return this.map.has(key);
// 	}
//
// 	delete(key: string, options?: { domain?: string; path?: string }): void {
// 		this.set({
// 			name: key,
// 			value: "",
// 			expires: new Date(0),
// 			path: options?.path || "/",
// 			domain: options?.domain,
// 		});
// 	}
//
// 	entries(): IterableIterator<[string, CookieOptions]> {
// 		return this.map.entries();
// 	}
//
// 	values(): Array<CookieOptions> {
// 		return Array.from(this.map.values());
// 	}
//
// 	keys(): Array<string> {
// 		return Array.from(this.map.keys());
// 	}
//
// 	static createHeader(opt: CookieOptions): string {
// 		let result = `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`;
//
// 		if (textIsDefined(opt.domain)) {
// 			result += `; Domain=${opt.domain}`;
// 		}
//
// 		if (textIsDefined(opt.path)) {
// 			result += `; Path=${opt.path}`;
// 		} else {
// 			result += `; Path=/`;
// 		}
//
// 		if (opt.expires) {
// 			if (typeof opt.expires === "number") {
// 				result += `; Expires=${new Date(opt.expires).toUTCString()}`;
// 			} else {
// 				result += `; Expires=${opt.expires.toUTCString()}`;
// 			}
// 		}
//
// 		if (opt.maxAge && Number.isInteger(opt.maxAge)) {
// 			result += `; Max-Age=${opt.maxAge}`;
// 		}
//
// 		if (opt.secure === true) {
// 			result += "; Secure";
// 		}
//
// 		if (opt.httpOnly === true) {
// 			result += "; HttpOnly";
// 		}
//
// 		if (opt.partitioned === true) {
// 			result += "; Partitioned";
// 		}
//
// 		if (textIsDefined(opt.sameSite)) {
// 			result += `; SameSite=${opt.sameSite}`;
// 		} else {
// 			result += `; SameSite=lax`;
// 		}
//
// 		return result;
// 	}
// }

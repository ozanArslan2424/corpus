import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";

import type { CookieOptions } from "@/internal/types/CookieOptions";
import type { CookiesInit } from "@/internal/types/CookiesInit";

import { capitalize } from "@/internal/utils/capitalize";
import { getEntries } from "@/internal/utils/getEntries";
import { textAfterMark } from "@/internal/utils/textAfterMark";
import { textIsDefined } from "@/internal/utils/textIsDefined";

export abstract class CookiesAbstract implements CookiesInterface {
	abstract set(opts: CookieOptions): void;
	abstract get(name: string): string | null;
	abstract has(name: string): boolean;
	abstract delete(opts: Pick<CookieOptions, "name" | "domain" | "path">): void;
	abstract entries(): IterableIterator<[string, string]>;
	abstract values(): Array<string>;
	abstract keys(): Array<string>;
	abstract toSetCookieHeaders(): Array<string>;

	applyInit(init: CookiesInit): void {
		if (init instanceof CookiesAbstract) {
			for (const [name, value] of init.entries()) {
				this.set({ name, value });
			}
		} else if (Array.isArray(init)) {
			for (const [name, value] of init) {
				if (!name || !value) continue;
				this.set({ name, value });
			}
		} else {
			for (const [name, value] of getEntries<string>(init)) {
				this.set({ name, value });
			}
		}
	}

	decodeValue(cookieString: string): string | null {
		const encodedValue = textAfterMark("=", cookieString);
		if (!encodedValue) return null;
		return decodeURIComponent(encodedValue);
	}

	createHeader(opts: CookieOptions): string {
		let result = `${encodeURIComponent(opts.name)}=${encodeURIComponent(opts.value)}`;

		if (textIsDefined(opts.domain)) {
			result += `; Domain=${opts.domain}`;
		}

		if (textIsDefined(opts.path)) {
			result += `; Path=${opts.path}`;
		} else {
			result += `; Path=/`;
		}

		if (opts.expires) {
			if (typeof opts.expires === "number") {
				result += `; Expires=${new Date(opts.expires).toUTCString()}`;
			} else {
				result += `; Expires=${opts.expires.toUTCString()}`;
			}
		}

		if (opts.maxAge && Number.isInteger(opts.maxAge)) {
			result += `; Max-Age=${opts.maxAge}`;
		}

		if (opts.secure === true) {
			result += "; Secure";
		}

		if (opts.httpOnly === true) {
			result += "; HttpOnly";
		}

		if (opts.partitioned === true) {
			result += "; Partitioned";
		}

		if (textIsDefined(opts.sameSite)) {
			result += `; SameSite=${capitalize(opts.sameSite)}`;
		} else {
			result += `; SameSite=Lax`;
		}

		return result;
	}
}

import { CookiesAbstract } from "@/Cookies/CookiesAbstract";
import type { CookieOptions } from "@/Cookies/types/CookieOptions";
import type { CookiesInit } from "@/Cookies/types/CookiesInit";
import { strIsDefined } from "@/utils/strIsDefined";
import { Parser } from "@/Model";
import { strAfterMark } from "@/utils/strAfterMark";
import { strBeforeMark } from "@/utils/strBeforeMark";
import { strCapitalize } from "@/utils/strCapitalize";
import { strSplit } from "@/utils/strSplit";
import type { UnknownObject } from "@/utils/types/UnknownObject";

export class CookiesUsingMap extends CookiesAbstract {
	constructor(init?: CookiesInit) {
		super();
		if (init) {
			this.applyInit(init);
		}
	}

	private map = new Map<string, string>();

	toSetCookieHeaders(): Array<string> {
		return Array.from(this.map.values());
	}

	set(opts: CookieOptions): void {
		this.map.set(opts.name, this.createHeader(opts));
	}

	setMany(optsArr: Array<CookieOptions>): void {
		for (const opts of optsArr) {
			this.set(opts);
		}
	}

	get(name: string): string | null {
		const cookieString = this.map.get(name);
		if (!cookieString) return null;
		const value = this.extractValue(cookieString);
		return strIsDefined(value) ? value : null;
	}

	has(name: string): boolean {
		const has = this.map.has(name);
		if (!has) return false;
		const value = this.get(name);
		return !!value;
	}

	get count(): number {
		return this.values().filter((value) => strIsDefined(value)).length;
	}

	delete(name: string): void {
		const cookieString = this.map.get(name);
		if (!cookieString) return;
		const opts = this.extractOptions(cookieString);
		this.set({ ...opts, value: "", expires: new Date(0) });
	}

	entries(): IterableIterator<[string, string]> {
		return this.map.entries();
	}

	values(): Array<string> {
		return Array.from(this.map.values()).map((cookieString) =>
			this.extractValue(cookieString),
		);
	}

	keys(): Array<string> {
		return Array.from(this.map.keys());
	}

	private extractValue(cookieString: string): string {
		const encodedRest = strAfterMark("=", cookieString);
		if (!strIsDefined(encodedRest)) return "";
		const encodedValue = strBeforeMark(";", encodedRest);
		return decodeURIComponent(encodedValue);
	}

	private extractOptions(cookieString: string): CookieOptions {
		const keyMap: Record<string, string> = {
			Domain: "domain",
			Path: "path",
			Expires: "expires",
			Secure: "secure",
			SameSite: "sameSite",
			HttpOnly: "httpOnly",
			Partitioned: "partitioned",
			"Max-Age": "maxAge",
		};

		const opts: UnknownObject = {};

		const first = strBeforeMark(";", cookieString).trim();
		const rest = strAfterMark(";", cookieString).trim();

		const [name, value] = strSplit("=", first);
		opts["name"] = name;
		opts["value"] = value;

		for (const part of strSplit(";", rest)) {
			if (part.includes("=")) {
				const [key, val] = strSplit("=", part, 2);
				if (!key || !keyMap[key]) {
					console.warn(`cookie extracting and ${key} is not a cookie key`);
					continue;
				}
				opts[keyMap[key]] = val ? Parser.processString(val) : undefined;
			} else {
				if (!keyMap[part]) {
					console.warn(`cookie extracting and ${part} is not a cookie key`);
					continue;
				}
				opts[keyMap[part]] = true;
			}
		}

		return opts as CookieOptions;
	}

	private createHeader(opts: CookieOptions): string {
		let result = `${encodeURIComponent(opts.name)}=${encodeURIComponent(opts.value)}`;

		if (strIsDefined(opts.domain)) {
			result += `; Domain=${opts.domain}`;
		}

		if (strIsDefined(opts.path)) {
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

		if (strIsDefined(opts.sameSite)) {
			result += `; SameSite=${strCapitalize(opts.sameSite)}`;
		} else {
			result += `; SameSite=Lax`;
		}

		return result;
	}
}

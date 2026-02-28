import type { HttpHeaderKey } from "@/Headers/types/HttpHeaderKey";
import type { HttpHeadersInit } from "@/Headers/types/HttpHeadersInit";
import { strIsDefined } from "@/utils/strIsDefined";

/** Headers is extended to include helpers and intellisense for common header names. */

export class HttpHeaders extends Headers {
	constructor(init?: HttpHeadersInit) {
		super(init);
	}

	override append(name: HttpHeaderKey, value: string): void {
		super.append(name, value);
	}

	override set(name: HttpHeaderKey, value: string): void {
		super.set(name, value);
	}

	override get(name: HttpHeaderKey): string | null {
		return super.get(name) || super.get(name.toLowerCase());
	}

	override has(name: HttpHeaderKey): boolean {
		return super.has(name) || super.has(name.toLowerCase());
	}

	override delete(name: HttpHeaderKey): void {
		return super.delete(name);
	}

	static combine(source: HttpHeaders, target: HttpHeaders): HttpHeaders {
		source.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				target.append(key, value);
			} else {
				target.set(key, value);
			}
		});

		return target;
	}

	innerCombine(source: HttpHeaders): void {
		HttpHeaders.combine(source, this);
	}

	setMany(
		init:
			| [string, string][]
			| (Record<string, string> & Partial<Record<HttpHeaderKey, string>>),
	): void {
		const entries = Array.isArray(init) ? init : Object.entries(init);
		for (const [key, value] of entries) {
			if (!strIsDefined(value)) continue;
			this.set(key, value);
		}
	}

	/** @deprecated */
	static findHeaderInInit(
		init: HttpHeadersInit,
		name: HttpHeaderKey,
	): string | null {
		if (init instanceof HttpHeaders || init instanceof Headers) {
			return init.get(name);
		} else if (Array.isArray(init)) {
			return init.find((entry) => entry[0] === name)?.[1] ?? null;
		} else {
			return init[name] ?? null;
		}
	}
}

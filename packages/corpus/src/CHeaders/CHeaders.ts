import type { CHeadersInit, HeaderKey } from "@/CHeaders/types";
import { objGetEntries } from "@/utils/objects";
import { strIsDefined } from "@/utils/strings";

/** CHeaders is extended to include helpers and intellisense for common header names. */

export class CHeaders extends Headers {
	constructor(init?: CHeadersInit) {
		super(init as HeadersInit);
	}

	override append(name: HeaderKey, value: string | string[]): void {
		if (Array.isArray(value)) {
			for (const v of value) {
				super.append(name, v);
			}
		} else {
			super.append(name, value);
		}
	}

	override set(name: HeaderKey, value: string | number | boolean): void {
		super.set(name, String(value));
	}

	override get(name: HeaderKey): string | null {
		return super.get(name) ?? super.get(name.toLowerCase());
	}

	override has(name: HeaderKey): boolean {
		return super.has(name) || super.has(name.toLowerCase());
	}

	override delete(name: HeaderKey): void {
		return super.delete(name);
	}

	static combine(source: CHeaders, target: CHeaders): CHeaders {
		source.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				target.append(key, value);
			} else {
				target.set(key, value);
			}
		});

		return target;
	}

	innerCombine(source: CHeaders): void {
		CHeaders.combine(source, this);
	}

	setMany(
		init: [string, string][] | (Record<string, string> & Partial<Record<HeaderKey, string>>),
	): void {
		const entries = Array.isArray(init) ? init : objGetEntries(init);
		for (const [key, value] of entries) {
			if (!strIsDefined(value)) continue;
			this.set(key, value);
		}
	}
}

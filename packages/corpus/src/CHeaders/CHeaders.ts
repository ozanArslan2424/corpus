import { strIsDefined } from "@/utils/strings";

import type { CHeaderKey } from "@/CHeaders/CHeaderKey";
import type { CHeadersInit } from "@/CHeaders/CHeadersInit";

/** Headers is extended to include helpers and intellisense for common header names. */

export class CHeaders extends Headers {
	constructor(init?: CHeadersInit) {
		super(init);
	}

	override append(name: CHeaderKey, value: string | string[]): void {
		if (Array.isArray(value)) {
			for (const v of value) {
				super.append(name, v);
			}
		} else {
			super.append(name, value);
		}
	}

	override set(name: CHeaderKey, value: string | number | boolean): void {
		super.set(name, String(value));
	}

	override get(name: CHeaderKey): string | null {
		return super.get(name) ?? super.get(name.toLowerCase());
	}

	override has(name: CHeaderKey): boolean {
		return super.has(name) || super.has(name.toLowerCase());
	}

	override delete(name: CHeaderKey): void {
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
		init: [string, string][] | (Record<string, string> & Partial<Record<CHeaderKey, string>>),
	): void {
		const entries = Array.isArray(init) ? init : Object.entries(init);
		for (const [key, value] of entries) {
			if (!strIsDefined(value)) continue;
			this.set(key, value);
		}
	}

	/** @deprecated */
	static findHeaderInInit(init: CHeadersInit, name: CHeaderKey): string | null {
		if (init instanceof CHeaders || init instanceof Headers) {
			return init.get(name);
		} else if (Array.isArray(init)) {
			return init.find((entry) => entry[0] === name)?.[1] ?? null;
		} else {
			return init[name] ?? null;
		}
	}
}

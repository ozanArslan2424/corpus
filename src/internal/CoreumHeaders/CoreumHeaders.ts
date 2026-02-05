import type { CoreumHeaderKey } from "@/internal/CoreumHeaders/CoreumHeaderKey";
import type { CoreumHeadersInit } from "@/internal/CoreumHeaders/CoreumHeadersInit";
import { getEntries } from "@/utils/getEntries";

export class CoreumHeaders extends Headers {
	constructor(init?: CoreumHeadersInit) {
		super(init);
	}

	override append(name: CoreumHeaderKey, value: string): void {
		super.append(name, value);
	}

	override set(name: CoreumHeaderKey, value: string): void {
		super.set(name, value);
	}

	/**
	 * @param source This is the one that's values are copied.
	 * @param target This is the one you get back.
	 * */
	static combine(source: CoreumHeaders, target: CoreumHeaders): CoreumHeaders {
		source.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				target.append(key, value);
			} else {
				target.set(key, value);
			}
		});

		return target;
	}

	innerCombine(source: CoreumHeaders): CoreumHeaders {
		return CoreumHeaders.combine(source, this);
	}

	setMany(init: CoreumHeadersInit) {
		for (const [key, value] of getEntries<string>(init)) {
			if (!value) continue;
			this.set(key, value);
		}
	}
}

import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumHeaderKey } from "@/internal/types/CoreumHeaderKey";
import type { CoreumHeadersInit } from "@/internal/types/CoreumHeadersInit";

import { getEntries } from "@/internal/utils/getEntries";
import { textIsDefined } from "@/internal/utils/textIsDefined";

export abstract class CoreumHeadersAbstract
	extends Headers
	implements CoreumHeadersInterface
{
	constructor(init?: CoreumHeadersInit) {
		super(init);
	}

	override append(name: CoreumHeaderKey, value: string): void {
		super.append(name, value);
	}

	override set(name: CoreumHeaderKey, value: string): void {
		super.set(name, value);
	}

	override get(name: string): string | null {
		return super.get(name) || super.get(name.toLowerCase());
	}

	override has(name: string): boolean {
		return super.has(name) || super.has(name.toLowerCase());
	}

	combine(
		source: CoreumHeadersInterface,
		target: CoreumHeadersInterface,
	): CoreumHeadersInterface {
		source.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				target.append(key, value);
			} else {
				target.set(key, value);
			}
		});

		return target;
	}

	innerCombine(source: CoreumHeadersInterface): CoreumHeadersInterface {
		return this.combine(source, this);
	}

	setMany(init: CoreumHeadersInit): void {
		for (const [key, value] of getEntries<string>(init)) {
			if (!textIsDefined(value)) continue;
			this.set(key, value);
		}
	}
}

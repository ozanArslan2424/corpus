import { CoreumHeadersAbstract } from "@/internal/modules/CoreumHeaders/CoreumHeadersAbstract";
import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";
import type { CoreumHeaderKey } from "@/internal/types/CoreumHeaderKey";
import type { CoreumHeadersInit } from "@/internal/types/CoreumHeadersInit";

/** Headers is extended to include helpers and intellisense for common header names. */

export class CoreumHeaders
	extends CoreumHeadersAbstract
	implements CoreumHeadersInterface
{
	static findHeaderInInit(
		init: CoreumHeadersInit,
		name: CoreumHeaderKey,
	): string | null {
		if (init instanceof CoreumHeaders || init instanceof Headers) {
			return init.get(name);
		} else if (Array.isArray(init)) {
			return init.find((entry) => entry[0] === name)?.[1] ?? null;
		} else {
			return init[name] ?? null;
		}
	}
}

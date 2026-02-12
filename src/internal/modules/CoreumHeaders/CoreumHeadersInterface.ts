import type { CoreumHeaderKey } from "@/internal/types/CoreumHeaderKey";
import type { CoreumHeadersInit } from "@/internal/types/CoreumHeadersInit";

export interface CoreumHeadersInterface extends Headers {
	append(name: CoreumHeaderKey, value: string): void;
	set(name: CoreumHeaderKey, value: string): void;
	combine(
		source: CoreumHeadersInterface,
		target: CoreumHeadersInterface,
	): CoreumHeadersInterface;
	innerCombine(source: CoreumHeadersInterface): CoreumHeadersInterface;
	setMany(init: CoreumHeadersInit): void;
}

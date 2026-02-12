import type { CookieOptions } from "@/internal/types/CookieOptions";
import type { CookiesInit } from "@/internal/types/CookiesInit";

export interface CookiesInterface {
	set(opts: CookieOptions): void;
	get(name: string): string | null;
	has(name: string): boolean;
	delete(opts: Pick<CookieOptions, "name" | "domain" | "path">): void;
	entries(): IterableIterator<[string, string]>;
	values(): Array<string>;
	keys(): Array<string>;
	decodeValue(cookieString: string): string | null;
	createHeader(opts: CookieOptions): string;
	toSetCookieHeaders(): string[];
	applyInit(init: CookiesInit): void;
}

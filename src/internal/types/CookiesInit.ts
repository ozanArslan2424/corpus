import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";

export type CookiesInit =
	| CookiesInterface
	| [string, string][]
	| Record<string, string>;

import type { HeaderKey } from "@/enums/HeaderKey";

export * from "./Cookies/types";

export * from "./Cors/types";

export * from "./Middleware/types";

export * from "./Registry/types";

export * from "./Req/types";

export * from "./Res/types";

export * from "./Route/types";

export * from "./Router/types";

export * from "./Server/types";

export interface ContextDataInterface {}
export interface Env {}

declare global {
	interface Headers {
		append(name: HeaderKey, value: string | string[]): void;
		set(name: HeaderKey, value: string | number | boolean): void;
		get(name: HeaderKey): string | null;
		has(name: HeaderKey): boolean;
		delete(name: HeaderKey): void;
		setMany(init: [HeaderKey, string][] | Partial<Record<HeaderKey, string>>): void;
		mergeWith(source: Headers): void;
	}
}

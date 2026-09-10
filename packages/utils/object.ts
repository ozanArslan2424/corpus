export type ValueOf<T> = T[keyof T];
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type DeepRequired<T> = T extends object ? { [K in keyof T]-?: DeepRequired<T[K]> } : T;

export function createSafeObject<T = Record<string, unknown>>(): T {
	return Object.create(null);
}

declare global {
	interface ObjectConstructor {
		keys<O extends object>(o: O): Array<keyof O>;
		values<O extends object>(o: O): Array<O[keyof O]>;
		entries<O extends object>(o: O): Array<[keyof O, O[keyof O]]>;
	}
}

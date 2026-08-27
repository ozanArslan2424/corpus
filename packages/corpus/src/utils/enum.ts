export type ValueOf<T> = T[keyof T];

export function enumerate<const T extends Record<string, string | number>>(obj: T): T {
	return obj;
}

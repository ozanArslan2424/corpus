import { isUndefined } from "@/utils/maybe";

export function assert<T>(condition: T | null | undefined, msg: string): asserts condition {
	if (!condition) throw new Error(msg);
}

export function assertDefined<T>(value: T | undefined, msg: string): asserts value is T {
	if (isUndefined(value)) throw new Error(msg);
}

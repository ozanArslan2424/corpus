import { isAbsent } from "./is";

interface AssertFn {
	<T>(condition: T | null | undefined, msg: string): asserts condition;
	present<T>(value: T | undefined, msg: string): asserts value is T;
}

function assertBase<T>(condition: T | null | undefined, msg: string): asserts condition {
	if (!condition) throw new Error(msg);
}

function assertPresent<T>(value: T | undefined, msg: string): asserts value is T {
	if (isAbsent(value)) throw new Error(msg);
}

const assert: AssertFn = Object.assign(assertBase, { present: assertPresent });

export { assert };

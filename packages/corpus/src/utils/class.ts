import { isFunction } from "@/utils/function";

type _Default = typeof _Default;
declare const _Default: unique symbol;
// oxlint-disable-next-line typescript/no-explicit-any
export type ConstructorOf<A extends abstract new (...args: any) => any, I = _Default> = {
	new (...args: ConstructorParameters<A>): I extends _Default ? InstanceType<A> : I;
};

// oxlint-disable-next-line typescript/no-explicit-any
export function isClass<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	return isFunction(input) && /^class\s/.test(Function.prototype.toString.call(input));
}

// oxlint-disable-next-line typescript/no-explicit-any
export function isNewable<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	if (!isFunction(input)) return false;
	try {
		Reflect.construct(String, [], input);
		return true;
	} catch {
		return false;
	}
}

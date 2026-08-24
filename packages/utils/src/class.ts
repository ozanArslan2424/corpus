import { isFunction } from "@/function";

type _Default = typeof _Default;
declare const _Default: unique symbol;
export type ConstructorOf<A extends abstract new (...args: any) => any, I = _Default> = {
	new (...args: ConstructorParameters<A>): I extends _Default ? InstanceType<A> : I;
};

export function isClass<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	return isFunction(input) && /^class\s/.test(Function.prototype.toString.call(input));
}

export function isNewable<T>(input: T): input is Extract<T, new (...args: any[]) => any> {
	if (!isFunction(input)) return false;
	try {
		Reflect.construct(String, [], input);
		return true;
	} catch {
		return false;
	}
}

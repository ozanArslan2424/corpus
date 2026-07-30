export type Primitive = string | number | boolean | bigint;

export type nil = null | undefined;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | nil;

export type ValueOf<T> = T[keyof T];

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type AddKind<K extends string, T> = { kind: K } & T;
export type GetKind<T extends AddKind<string, unknown>, K extends string> = Extract<T, { kind: K }>;

type _Default = typeof _Default;
declare const _Default: unique symbol;
export type ConstructorOf<A extends abstract new (...args: any) => any, I = _Default> = {
	new (...args: ConstructorParameters<A>): I extends _Default ? InstanceType<A> : I;
};

export type Replace<T, K extends keyof T, V> = Omit<T, K> & { [P in K]: V };

export type OmitMethods<T> = {
	[K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};

export type OmitTypes<T, O> = {
	[K in keyof T as [T[K]] extends [O] ? never : K]: T[K];
};

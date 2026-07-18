import type { SnakeCase } from "@/utils/strings";

export type Primitive = string | number | boolean | bigint;

export type nil = null | undefined;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Maybe<T> = T | nil;

export type IDPattern = `${string}.${string}.${string}`;

export type UnknownArray = Array<unknown>;

export type UnknownObject = Record<string, unknown>;

export type ValueOf<T> = T[keyof T];

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type OrString<T> = T | (string & {});

export type MaybePromise<T> = Promise<T> | T;

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

export type SnakeCaseKeys<T> = {
	[K in keyof T as SnakeCase<K & string>]: T[K];
};

export type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

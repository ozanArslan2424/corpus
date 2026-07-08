import { assert } from "./assert";

// ---- type-level helpers ----
export type OrString<T> = T | (string & {});

type Separator = " " | "_" | "-" | "/" | ".";

/** Split on separators AND camelCase humps into a tuple of words (lowercased boundaries preserved). */
type Words<S extends string> = SplitSeparators<S>;

type SplitSeparators<S extends string> = S extends `${infer Head}${Separator}${infer Tail}`
	? [...SplitSeparators<Head>, ...SplitSeparators<Tail>]
	: SplitCamel<S>;

type SplitCamel<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends Uppercase<C>
		? C extends Lowercase<C>
			? // non-alpha (digit/symbol) — keep accumulating
				SplitCamel<Rest, `${Acc}${C}`>
			: // uppercase letter — boundary
				Acc extends ""
				? SplitCamel<Rest, C>
				: [Acc, ...SplitCamel<Rest, C>]
		: SplitCamel<Rest, `${Acc}${C}`>
	: Acc extends ""
		? []
		: [Acc];

type JoinPascal<W extends string[]> = W extends [
	infer H extends string,
	...infer R extends string[],
]
	? `${Capitalize<H>}${JoinPascal<R>}`
	: ""; // OrString doesn't work here

type JoinCamel<W extends string[]> = W extends [infer H extends string, ...infer R extends string[]]
	? `${Lowercase<H>}${JoinPascal<R>}`
	: OrString<"">;

type JoinWith<W extends string[], D extends string> = W extends [
	infer H extends string,
	...infer R extends string[],
]
	? R extends []
		? Lowercase<H>
		: `${Lowercase<H>}${D}${JoinWith<R, D>}`
	: OrString<"">;

export type PascalCase<S extends string> = JoinPascal<Words<S>>;
export type CamelCase<S extends string> = JoinCamel<Words<S>>;
export type SnakeCase<S extends string> = JoinWith<Words<S>, "_">;
export type KebabCase<S extends string> = JoinWith<Words<S>, "-">;

// ---- runtime implementations ----

export function toPascalCase<K extends string>(key: K): PascalCase<K> {
	return key
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join("") as PascalCase<K>;
}

export function toCamelCase<K extends string>(key: K): CamelCase<K> {
	const parts = key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean);
	if (parts.length === 0) return key as unknown as CamelCase<K>;
	const [first, ...rest] = parts;
	return (first!.toLowerCase() +
		rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")) as CamelCase<K>;
}

export function toSnakeCase<K extends string>(key: K): SnakeCase<K> {
	return key
		.replace(/([a-z])([A-Z])/g, "$1_$2")
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase() as SnakeCase<K>;
}

export function toKebabCase<K extends string>(key: K): KebabCase<K> {
	return key
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase() as KebabCase<K>;
}

export function toDisplayName(key: string): string {
	return key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(" ");
}

export function backtick(s: string) {
	return `\`${s}\``;
}

export function quote(s: string) {
	return `"${s}"`;
}

export function singlequote(s: string) {
	return `'${s}'`;
}

export function isPattern<T extends string>(value: string, pattern: RegExp): value is T {
	return pattern.test(value);
}

export function strAfterMark(mark: string, input: string): string {
	const index = input.indexOf(mark);
	return index === -1 ? "" : input.slice(index + mark.length);
}

export function strBeforeMark(mark: string, input: string): string {
	const index = input.indexOf(mark);
	return index === -1 ? input : input.slice(0, index);
}

export function strRemoveExt(str: string) {
	return str.replace(/\.(ts|js|tsx|jsx)$/, "");
}

export function strRemoveWhitespace(str: string) {
	return str.trim().replace(/\s+/g, "");
}

export function strSplit(mark: string, input: string, minLength?: number): string[] {
	const parts = input
		.split(mark)
		.map((part) => part.trim())
		.filter(Boolean);

	if (minLength) {
		assert(parts.length >= minLength);
		return parts;
	}

	return parts;
}

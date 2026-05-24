import type { OrString } from "corpus-utils/OrString";

import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import type { TypescriptWriter } from "./TypescriptWriter";

export namespace ClassWriterTypes {
	type BodyWriter = B.BodyWriter<TypescriptWriter>;

	type MemberKeyword =
		| "public"
		| "protected"
		| "private"
		| "public readonly"
		| "protected readonly"
		| "private readonly"
		| "public static"
		| "protected static"
		| "private static"
		| "public static readonly"
		| "protected static readonly"
		| "private static readonly"
		| "readonly"
		| "static"
		| "static readonly"
		| "declare"
		| "declare readonly";

	type MethodKeyword =
		| "public"
		| "protected"
		| "private"
		| "public static"
		| "protected static"
		| "private static"
		| "public abstract"
		| "protected abstract"
		| "public static abstract"
		| "protected static abstract"
		| "override"
		| "public override"
		| "protected override"
		| "private override";

	export type Constructor = {
		args?: { keyword?: MemberKeyword; key: string; type: string }[];
		superArgs?: string;
		body?: BodyWriter;
	};

	export type Class = {
		isExported?: boolean;
		extends?: string;
		implements?: string;
		isAbstract?: boolean;
		name: string;
		body: BodyWriter;
		generics?: string[];
		constr?: Constructor;
	};

	type MethodBase = {
		name: string;
		keyword?: MethodKeyword;
		args?: B.TypedArg[];
		generics?: string[];
		isAsync?: boolean;
		type?: string;
		body: BodyWriter;
	};

	export type Method = MethodBase;

	export type MethodOverload1 = Required<Pick<MethodBase, "name" | "type">>;
	export type MethodOverload2 = Omit<MethodBase, "name" | "type" | "body">;

	export type ArrowMethod = Omit<MethodBase, "args"> & {
		args?: OrString<B.TypedArg>[];
	};

	export type AbstractMethod = Omit<MethodBase, "body">;

	export type Member = {
		name: string;
		type?: string;
		value: string | BodyWriter;
		keyword?: MemberKeyword;
	};
}

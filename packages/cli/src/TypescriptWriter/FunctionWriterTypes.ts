import type { OrString } from "corpus-utils/OrString";

import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import type { TypescriptWriter } from "./TypescriptWriter";

export namespace FunctionWriterTypes {
	type BodyWriter = B.BodyWriter<TypescriptWriter>;

	type FunctionBase = {
		isExported?: boolean;
		name: string;
		args?: B.TypedArg[];
		generics?: string[];
		isAsync?: boolean;
		type?: string;
		body: BodyWriter;
	};

	export type Function = FunctionBase;

	export type FunctionOverload1 = Required<Pick<FunctionBase, "name" | "type">>;
	export type FunctionOverload2 = Omit<FunctionBase, "name" | "type" | "body">;

	export type Arrow = Omit<FunctionBase, "args"> & {
		keyword?: "const" | "let" | "var";
		args?: OrString<B.TypedArg>[];
	};
}

import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import type { TypescriptWriter } from "./TypescriptWriter";

export namespace VariableWriterTypes {
	type BodyWriter = B.BodyWriter<TypescriptWriter>;

	type Base = {
		name: string;
		type?: string;
		value: string | BodyWriter;
		isExported?: boolean;
	};

	export type Const = Base;
	export type Let = Omit<Base, "value"> & { value?: string | BodyWriter };
	export type Var = Base;
	export type Type = Omit<Base, "value" | "type"> & {
		generics?: string[];
		value: (string | BodyWriter) | (string | BodyWriter)[];
	};

	export type Assign =
		| { type?: string; as?: string; satisfies?: string }
		| { type?: string; as?: string; satisfies?: string };

	export type Namespace = {
		isExported?: boolean;
		name: string;
		body: BodyWriter;
	};
}

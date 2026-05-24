import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import type { TypescriptWriter } from "./TypescriptWriter";

export namespace InterfaceWriterTypes {
	type BodyWriter = B.BodyWriter<TypescriptWriter>;

	type BaseInterface = {
		isExported?: boolean;
		name: string;
		generics?: string[];
		body: BodyWriter;
	};
	type InterfaceInterface = B.Disco<"interface", BaseInterface & { extends?: string }>;
	type TypeInterface = B.Disco<"type", BaseInterface & { extends?: string }>;

	export type Interface = InterfaceInterface | TypeInterface;
}

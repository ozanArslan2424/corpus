import type { OrString } from "corpus-utils/OrString";

import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import type { TypescriptWriter } from "./TypescriptWriter";

export namespace StatementWriterTypes {
	type BodyWriter = B.BodyWriter<TypescriptWriter>;

	export type Condition = OrString<"&&" | "||">;

	export type Else = (finalBody: BodyWriter) => void;

	export type ElseIf = (...conditions: Condition[]) => {
		then(body: BodyWriter): {
			elseif: ElseIf;
			else: Else;
		};
	};

	export type If = {
		then(body: BodyWriter): {
			elseif: ElseIf;
			else: Else;
		};
	};

	export type ForParan = OrString<"const" | "let" | "in" | "of">;

	export type SwitchCase = {
		condition: OrString<"default">;
		body: BodyWriter;
		break?: boolean;
	};

	export type TryCatch = {
		try: BodyWriter;
		catch?: { arg?: string; body: BodyWriter };
		finally?: BodyWriter;
	};

	type CmmLine = { text: string };

	type CmmBlock = { lines: string[] };

	type CmmJsDoc = { lines: string[] };

	export type Comment =
		| B.Disco<"line", CmmLine>
		| B.Disco<"block", CmmBlock>
		| B.Disco<"jsdoc", CmmJsDoc>
		| string;

	type ExpObj = { keys: string[] };

	type ExpType = { keys: string[] };

	type ExpDefault = { keys: string[] };

	type ExpNamed = { name: string; keys: string[] };

	type ExpReExp = { from: string; keys: string[] };

	type ExpReExpStar = { from: string };

	export type Export =
		| B.Disco<"object", ExpObj>
		| B.Disco<"type", ExpType>
		| B.Disco<"default", ExpDefault>
		| B.Disco<"named", ExpNamed>
		| B.Disco<"reexport", ExpReExp>
		| B.Disco<"reexportStar", ExpReExpStar>;

	type ImpAs = { key: string; as?: string; isType?: boolean };

	export type Import = {
		keys?: string[] | ImpAs[];
		def?: string | ImpAs;
		isType?: boolean;
		from: string;
	};

	export type Throw = { errorType?: string; args: string };
}

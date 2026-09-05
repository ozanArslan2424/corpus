import { type BodyParserInterface, BodyParser } from "@/BodyParser";
import { FormDataParser } from "@/FormDataParser";
import { Globals } from "@/Globals";
import type { ParserBaseInterface } from "@/ParserBase";
import { type SchemaParserInterface, SchemaParser } from "@/SchemaParser";
import { SearchParamsParser } from "@/SearchParamsParser";
import { URLParamsParser } from "@/URLParamsParser";

interface ParsersRegistry {
	urlParamsParser: ParserBaseInterface<Record<string, string>>;
	searchParamsParser: ParserBaseInterface<URLSearchParams>;
	formDataParser: ParserBaseInterface<FormData>;
	bodyParser: BodyParserInterface;
	schemaParser: SchemaParserInterface;
}

function getOrInitParsersRegistry(): ParsersRegistry {
	try {
		return Globals.get("parsers");
	} catch {
		return Globals.create("parsers", () => {
			const urlParamsParser = new URLParamsParser();
			const searchParamsParser = new SearchParamsParser();
			const formDataParser = new FormDataParser();
			const bodyParser = new BodyParser();
			const schemaParser = new SchemaParser();
			return { urlParamsParser, searchParamsParser, formDataParser, bodyParser, schemaParser };
		});
	}
}

/**
 * Overrides one or more parsers. Only the provided keys are replaced;
 * unspecified parsers keep their current implementation.
 */
function setParsersRegistry(overrides: Partial<ParsersRegistry>): void {
	Object.assign(getOrInitParsersRegistry(), overrides);
}

export type { ParsersRegistry };
export { setParsersRegistry, getOrInitParsersRegistry };

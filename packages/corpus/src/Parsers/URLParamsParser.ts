import { ObjectParserAbstract } from "@/Parsers/ObjectParserAbstract";

export class URLParamsParser extends ObjectParserAbstract<Record<string, string>> {
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

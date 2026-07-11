import { ObjectParserAbstract } from "@/Parser/ObjectParserAbstract";

export class URLParamsParser extends ObjectParserAbstract<Record<string, string>> {
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = this.newSafeObject();
		for (const [key, value] of Object.entries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

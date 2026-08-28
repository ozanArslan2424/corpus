import { createSafeObject } from "@/utils";
import { ParserBase } from "@/X/ParserBase/ParserBase";

export class URLParamsParser extends ParserBase<Record<string, string>> {
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = createSafeObject();
		for (const [key, value] of Object.entries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

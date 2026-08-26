import { createSafeObject } from "@ozanarslan/utils";

import { ObjectParserAbstract } from "@/X/ObjectParserAbstract";

export class URLParamsParser extends ObjectParserAbstract<Record<string, string>> {
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = createSafeObject();
		for (const [key, value] of Object.entries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

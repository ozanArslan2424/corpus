import type { UnknownObject } from "@/utils/UnknownObject";

import { ObjectParserAbstract } from "@/Parser/ObjectParserAbstract";

export class URLParamsParser extends ObjectParserAbstract<Record<string, string>> {
	parse(input: Record<string, string>): UnknownObject {
		const data: UnknownObject = {};
		for (const [key, value] of Object.entries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

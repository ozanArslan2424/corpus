import { ParserBase } from "@/ParserBase";
import { createSafeObject, objGetEntries } from "@/utils/object";

class URLParamsParser extends ParserBase<Record<string, string>> {
	parse(input: Record<string, string>): Record<string, unknown> {
		const data: Record<string, unknown> = createSafeObject();
		for (const [key, value] of objGetEntries(input)) {
			data[key] = this.tryParseJSON(decodeURIComponent(value));
		}
		return data;
	}
}

export { URLParamsParser };

import { afterEach, describe, expect, it } from "bun:test";

import { Globals } from "@/Globals";
import { getOrInitParsersRegistry, setParsersRegistry } from "@/Globals/ParsersRegistry";
import { BodyParser } from "@/ParserBase/BodyParser";
import { FormDataParser } from "@/ParserBase/FormDataParser";
import { SchemaParser } from "@/ParserBase/SchemaParser";
import { SearchParamsParser } from "@/ParserBase/SearchParamsParser";
import { URLParamsParser } from "@/ParserBase/URLParamsParser";

afterEach(() => {
	if (Globals.has("parsers")) Globals.delete("parsers");
});

describe("getOrInitParsers", () => {
	it("initializes a registry with real parser instances when none exists yet", () => {
		const parsers = getOrInitParsersRegistry();
		expect(parsers.urlParamsParser).toBeInstanceOf(URLParamsParser);
		expect(parsers.searchParamsParser).toBeInstanceOf(SearchParamsParser);
		expect(parsers.formDataParser).toBeInstanceOf(FormDataParser);
		expect(parsers.bodyParser).toBeInstanceOf(BodyParser);
		expect(parsers.schemaParser).toBeInstanceOf(SchemaParser);
	});

	it("returns the existing registry on subsequent calls instead of re-initializing", () => {
		const first = getOrInitParsersRegistry();
		const second = getOrInitParsersRegistry();
		expect(second).toBe(first);
	});

	it("returns the same registry that Globals.get exposes once initialized", () => {
		const parsers = getOrInitParsersRegistry();
		expect(Globals.get("parsers")).toBe(parsers);
	});
});

describe("setParsers", () => {
	it("initializes the registry as a side effect if it doesn't exist yet, then applies overrides", () => {
		expect(Globals.has("parsers")).toBe(false);
		const override = { parse: () => ({ from: "override" }) };

		setParsersRegistry({ formDataParser: override });

		expect(getOrInitParsersRegistry().formDataParser).toBe(override);
	});

	it("only overrides the provided keys, leaving the rest untouched", () => {
		const original = getOrInitParsersRegistry();
		const originalSearchParamsParser = original.searchParamsParser;
		const override = { parse: () => ({ from: "override" }) };

		setParsersRegistry({ formDataParser: override });

		expect(getOrInitParsersRegistry().formDataParser).toBe(override);
		expect(getOrInitParsersRegistry().searchParamsParser).toBe(originalSearchParamsParser);
	});
});

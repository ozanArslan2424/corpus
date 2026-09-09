import { describe, expect, it } from "bun:test";

import { FormDataParser } from "@/ParserBase/FormDataParser";

function makeFormData(entries: [string, string | Blob][]): FormData {
	const fd = new FormData();
	for (const [key, value] of entries) fd.append(key, value);
	return fd;
}

describe("FormDataParser", () => {
	const parser = new FormDataParser();

	it("parses flat string values", () => {
		const fd = makeFormData([["name", "Ozan"]]);
		expect(parser.parse(fd)).toEqual({ name: "Ozan" });
	});

	it("parses JSON-looking string values into their real types", () => {
		const fd = makeFormData([
			["age", "26"],
			["active", "true"],
			["meta", '{"a":1}'],
		]);
		expect(parser.parse(fd)).toEqual({
			age: 26,
			active: true,
			meta: { a: 1 },
		});
	});

	it("leaves non-JSON strings as-is", () => {
		const fd = makeFormData([["name", "Ozan Arslan"]]);
		expect(parser.parse(fd)).toEqual({ name: "Ozan Arslan" });
	});

	it("keeps File entries as File instances, not JSON-parsed", () => {
		const file = new File(["content"], "test.txt", { type: "text/plain" });
		const fd = makeFormData([["upload", file]]);
		const result = parser.parse(fd);
		expect(result.upload).toBeInstanceOf(File);
		expect(result.upload).toEqual(file);
	});

	it("builds nested objects from dot notation", () => {
		const fd = makeFormData([
			["user.name", "Ozan"],
			["user.age", "26"],
		]);
		expect(parser.parse(fd)).toEqual({
			user: { name: "Ozan", age: 26 },
		});
	});

	it("builds nested objects from bracket notation", () => {
		const fd = makeFormData([["user[name]", "Ozan"]]);
		expect(parser.parse(fd)).toEqual({ user: { name: "Ozan" } });
	});

	it("builds arrays from numeric bracket indices", () => {
		const fd = makeFormData([
			["items[0]", "a"],
			["items[1]", "b"],
		]);
		expect(parser.parse(fd)).toEqual({ items: ["a", "b"] });
	});

	it("builds arrays of objects from mixed nested keys", () => {
		const fd = makeFormData([
			["items[0].name", "a"],
			["items[1].name", "b"],
		]);
		expect(parser.parse(fd)).toEqual({
			items: [{ name: "a" }, { name: "b" }],
		});
	});

	it("handles array values", () => {
		const fd = makeFormData([
			["tag", "a"],
			["tag", "b"],
		]);
		// promotes a single value to an array on second write to the same key
		expect(parser.parse(fd)).toEqual({ tag: ["a", "b"] });
		// appends to an existing array on further writes to the same key
		fd.append("tag", "c");
		expect(parser.parse(fd)).toEqual({ tag: ["a", "b", "c"] });
	});

	it("returns an empty object for empty FormData", () => {
		const fd = new FormData();
		expect(parser.parse(fd)).toEqual({});
	});
});

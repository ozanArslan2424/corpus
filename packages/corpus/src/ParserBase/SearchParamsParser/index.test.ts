import { describe, expect, it } from "bun:test";

import { SearchParamsParser } from "@/ParserBase/SearchParamsParser";

function makeSearchParams(entries: [string, string][]): URLSearchParams {
	const sp = new URLSearchParams();
	for (const [key, value] of entries) sp.append(key, value);
	return sp;
}

describe("SearchParamsParser", () => {
	const parser = new SearchParamsParser();

	it("parses flat string values", () => {
		const sp = makeSearchParams([["name", "Ozan"]]);
		expect(parser.parse(sp)).toEqual({ name: "Ozan" });
	});

	it("parses JSON-looking string values into their real types", () => {
		const sp = makeSearchParams([
			["age", "26"],
			["active", "true"],
			["meta", '{"a":1}'],
		]);
		expect(parser.parse(sp)).toEqual({
			age: 26,
			active: true,
			meta: { a: 1 },
		});
	});

	it("leaves non-JSON strings as-is", () => {
		const sp = makeSearchParams([["name", "Ozan Arslan"]]);
		expect(parser.parse(sp)).toEqual({ name: "Ozan Arslan" });
	});

	it("builds nested objects from dot notation", () => {
		const sp = makeSearchParams([
			["user.name", "Ozan"],
			["user.age", "26"],
		]);
		expect(parser.parse(sp)).toEqual({
			user: { name: "Ozan", age: 26 },
		});
	});

	it("builds nested objects from bracket notation", () => {
		const sp = makeSearchParams([["user[name]", "Ozan"]]);
		expect(parser.parse(sp)).toEqual({ user: { name: "Ozan" } });
	});

	it("builds arrays from numeric bracket indices", () => {
		const sp = makeSearchParams([
			["items[0]", "a"],
			["items[1]", "b"],
		]);
		expect(parser.parse(sp)).toEqual({ items: ["a", "b"] });
	});

	it("builds arrays of objects from mixed nested keys", () => {
		const sp = makeSearchParams([
			["items[0].name", "a"],
			["items[1].name", "b"],
		]);
		expect(parser.parse(sp)).toEqual({
			items: [{ name: "a" }, { name: "b" }],
		});
	});

	it("promotes a single value to an array on second write to the same key", () => {
		const sp = makeSearchParams([
			["tag", "a"],
			["tag", "b"],
		]);
		expect(parser.parse(sp)).toEqual({ tag: ["a", "b"] });
	});

	it("appends to an existing array on further writes to the same key", () => {
		const sp = makeSearchParams([
			["tag", "a"],
			["tag", "b"],
			["tag", "c"],
		]);
		expect(parser.parse(sp)).toEqual({ tag: ["a", "b", "c"] });
	});

	it("returns an empty object for empty URLSearchParams", () => {
		const sp = new URLSearchParams();
		expect(parser.parse(sp)).toEqual({});
	});

	it("replaces a scalar with a container when a later key needs to descend into it", () => {
		// "user" is written as a plain scalar first, then "user.name" needs
		// to treat `user` as an object to descend into - the scalar is discarded.
		const sp = makeSearchParams([
			["user", "foo"],
			["user.name", "bar"],
		]);
		expect(parser.parse(sp)).toEqual({ user: { name: "bar" } });
	});

	it("replaces a scalar with an array when a later indexed key needs to descend into it", () => {
		const sp = makeSearchParams([
			["items", "foo"],
			["items[0]", "bar"],
		]);
		expect(parser.parse(sp)).toEqual({ items: ["bar"] });
	});

	it("promotes an object to an array when a plain key is written after a nested one", () => {
		// here the nested write happens first (building an object at `user`),
		// then a plain "user" write hits the last-part branch and promotes to array
		const sp = makeSearchParams([
			["user.name", "bar"],
			["user", "foo"],
		]);
		expect(parser.parse(sp)).toEqual({ user: [{ name: "bar" }, "foo"] });
	});
});

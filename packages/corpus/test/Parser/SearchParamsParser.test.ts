import { describe, it, expect } from "bun:test";

import { SearchParamsParser } from "@/Parser/SearchParamsParser";

describe("SearchParamsParser", () => {
	const parser = new SearchParamsParser();

	describe("parseKey", () => {
		it("handles flat key", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("title")).toEqual(["title"]);
		});
		it("handles bracket index", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("items[0]")).toEqual(["items", 0]);
		});
		it("handles bracket index with dot field", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("items[0].name")).toEqual(["items", 0, "name"]);
		});
		it("handles bracket index with bracket field", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("items[0][name]")).toEqual(["items", 0, "name"]);
		});
		it("handles deep dot notation", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("a.b.c")).toEqual(["a", "b", "c"]);
		});
		it("handles mixed deep notation", () => {
			// @ts-expect-error protected
			expect(parser.parseKey("a[0].b[1][c]")).toEqual(["a", 0, "b", 1, "c"]);
		});
	});

	describe("toObject", () => {
		it("handles empty URLSearchParams", () => {
			expect(parser.parse(new URLSearchParams())).toEqual({});
		});

		it("handles flat fields", () => {
			const sp = new URLSearchParams();
			sp.set("title", "hello");
			sp.set("count", "5");
			expect(parser.parse(sp)).toEqual({ title: "hello", count: 5 });
		});

		it("handles flat array via repeated keys", () => {
			const sp = new URLSearchParams();
			sp.append("ids", "1");
			sp.append("ids", "2");
			sp.append("ids", "3");
			expect(parser.parse(sp)).toEqual({ ids: [1, 2, 3] });
		});

		it("handles indexed array", () => {
			const sp = new URLSearchParams();
			sp.append("ids[0]", "1");
			sp.append("ids[1]", "2");
			expect(parser.parse(sp)).toEqual({ ids: [1, 2] });
		});

		it("handles array of objects via dot notation", () => {
			const sp = new URLSearchParams();
			sp.append("items[0].name", "foo");
			sp.append("items[0].qty", "2");
			sp.append("items[1].name", "bar");
			sp.append("items[1].qty", "3");
			expect(parser.parse(sp)).toEqual({
				items: [
					{ name: "foo", qty: 2 },
					{ name: "bar", qty: 3 },
				],
			});
		});

		it("handles array of objects via bracket notation", () => {
			const sp = new URLSearchParams();
			sp.append("items[0][name]", "foo");
			sp.append("items[0][qty]", "2");
			expect(parser.parse(sp)).toEqual({
				items: [{ name: "foo", qty: 2 }],
			});
		});

		it("handles json string value", () => {
			const sp = new URLSearchParams();
			sp.set("data", JSON.stringify({ materialId: 3, quantity: 1 }));
			expect(parser.parse(sp)).toEqual({
				data: { materialId: 3, quantity: 1 },
			});
		});

		it("handles indexed array of json objects", () => {
			const sp = new URLSearchParams();
			sp.append("items[0]", JSON.stringify({ materialId: 3, quantity: 1 }));
			sp.append("items[1]", JSON.stringify({ materialId: 5, quantity: 2 }));
			expect(parser.parse(sp)).toEqual({
				items: [
					{ materialId: 3, quantity: 1 },
					{ materialId: 5, quantity: 2 },
				],
			});
		});

		it("handles nested dot notation", () => {
			const sp = new URLSearchParams();
			sp.set("a.b.c", "deep");
			expect(parser.parse(sp)).toEqual({ a: { b: { c: "deep" } } });
		});

		it("handles mixed flat and nested fields", () => {
			const sp = new URLSearchParams();
			sp.set("title", "recipe");
			sp.set("isPublic", "true");
			sp.append("deletedIds[0]", "1");
			sp.append("deletedIds[1]", "2");
			sp.append("newItems[0].materialId", "3");
			sp.append("newItems[0].quantity", "1.5");
			expect(parser.parse(sp)).toEqual({
				title: "recipe",
				isPublic: true,
				deletedIds: [1, 2],
				newItems: [{ materialId: 3, quantity: 1.5 }],
			});
		});
	});

	describe("duplicate-key merging", () => {
		it("merges duplicate nested dot-notation keys into an array", () => {
			const sp = new URLSearchParams();
			sp.append("a.b", "x");
			sp.append("a.b", "y");
			expect(parser.parse(sp)).toEqual({ a: { b: ["x", "y"] } });
		});

		it("merges three+ duplicate nested keys into a single array", () => {
			const sp = new URLSearchParams();
			sp.append("a.b", "x");
			sp.append("a.b", "y");
			sp.append("a.b", "z");
			expect(parser.parse(sp)).toEqual({ a: { b: ["x", "y", "z"] } });
		});

		it("merges duplicate bracket-indexed keys at the same slot", () => {
			const sp = new URLSearchParams();
			sp.append("a[0]", "x");
			sp.append("a[0]", "y");
			expect(parser.parse(sp)).toEqual({ a: [["x", "y"]] });
		});
	});

	describe("prototype safety", () => {
		it("does not pollute Object.prototype via __proto__ key", () => {
			const sp = new URLSearchParams();
			sp.set("__proto__.polluted", "yes");
			parser.parse(sp);
			// @ts-expect-error intentional probe
			expect({}.polluted).toBeUndefined();
		});

		it("does not pollute Object.prototype via nested __proto__ key", () => {
			const sp = new URLSearchParams();
			sp.set("a.__proto__.polluted", "yes");
			parser.parse(sp);
			// @ts-expect-error intentional probe
			expect({}.polluted).toBeUndefined();
		});

		it("produces null-prototype root object", () => {
			const sp = new URLSearchParams();
			sp.set("x", "1");
			const result = parser.parse(sp);
			expect(Object.getPrototypeOf(result)).toBeNull();
		});
	});
});

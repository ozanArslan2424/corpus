import { describe, it, expect } from "bun:test";

import { FormDataParser } from "@/Parser/FormDataParser";

describe("FormDataParser", () => {
	const parser = new FormDataParser();

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
		it("handles empty FormData", () => {
			expect(parser.parse(new FormData())).toEqual({});
		});

		it("handles flat fields", () => {
			const fd = new FormData();
			fd.set("title", "hello");
			fd.set("count", "5");
			expect(parser.parse(fd)).toEqual({ title: "hello", count: 5 });
		});

		it("handles flat array via repeated keys", () => {
			const fd = new FormData();
			fd.append("ids", "1");
			fd.append("ids", "2");
			fd.append("ids", "3");
			expect(parser.parse(fd)).toEqual({ ids: [1, 2, 3] });
		});

		it("handles indexed array", () => {
			const fd = new FormData();
			fd.append("ids[0]", "1");
			fd.append("ids[1]", "2");
			expect(parser.parse(fd)).toEqual({ ids: [1, 2] });
		});

		it("handles array of objects via dot notation", () => {
			const fd = new FormData();
			fd.append("items[0].name", "foo");
			fd.append("items[0].qty", "2");
			fd.append("items[1].name", "bar");
			fd.append("items[1].qty", "3");
			expect(parser.parse(fd)).toEqual({
				items: [
					{ name: "foo", qty: 2 },
					{ name: "bar", qty: 3 },
				],
			});
		});

		it("handles array of objects via bracket notation", () => {
			const fd = new FormData();
			fd.append("items[0][name]", "foo");
			fd.append("items[0][qty]", "2");
			expect(parser.parse(fd)).toEqual({
				items: [{ name: "foo", qty: 2 }],
			});
		});

		it("handles json string value", () => {
			const fd = new FormData();
			fd.set("data", JSON.stringify({ materialId: 3, quantity: 1 }));
			expect(parser.parse(fd)).toEqual({
				data: { materialId: 3, quantity: 1 },
			});
		});

		it("handles indexed array of json objects", () => {
			const fd = new FormData();
			fd.append("items[0]", JSON.stringify({ materialId: 3, quantity: 1 }));
			fd.append("items[1]", JSON.stringify({ materialId: 5, quantity: 2 }));
			expect(parser.parse(fd)).toEqual({
				items: [
					{ materialId: 3, quantity: 1 },
					{ materialId: 5, quantity: 2 },
				],
			});
		});

		it("handles nested dot notation", () => {
			const fd = new FormData();
			fd.set("a.b.c", "deep");
			expect(parser.parse(fd)).toEqual({ a: { b: { c: "deep" } } });
		});

		it("handles mixed flat and nested fields", () => {
			const fd = new FormData();
			fd.set("title", "recipe");
			fd.set("isPublic", "true");
			fd.append("deletedIds[0]", "1");
			fd.append("deletedIds[1]", "2");
			fd.append("newItems[0].materialId", "3");
			fd.append("newItems[0].quantity", "1.5");
			expect(parser.parse(fd)).toEqual({
				title: "recipe",
				isPublic: true,
				deletedIds: [1, 2],
				newItems: [{ materialId: 3, quantity: 1.5 }],
			});
		});

		it("handles File value", () => {
			const fd = new FormData();
			const file = new File([""], "image.png", { type: "image/png" });
			fd.set("image", file);
			const result = parser.parse(fd);
			expect(result.image).toBeInstanceOf(File);
		});

		it("does not JSON-parse File values", () => {
			const fd = new FormData();
			const file = new File(["123"], "x.txt", { type: "text/plain" });
			fd.set("upload", file);
			const parsed = parser.parse(fd).upload;
			expect(parsed).toBeInstanceOf(File);
			expect(parsed).toEqual(file);
		});
	});

	describe("duplicate-key merging", () => {
		it("merges duplicate nested dot-notation keys into an array", () => {
			const fd = new FormData();
			fd.append("a.b", "x");
			fd.append("a.b", "y");
			expect(parser.parse(fd)).toEqual({ a: { b: ["x", "y"] } });
		});

		it("merges three+ duplicate nested keys into a single array", () => {
			const fd = new FormData();
			fd.append("a.b", "x");
			fd.append("a.b", "y");
			fd.append("a.b", "z");
			expect(parser.parse(fd)).toEqual({ a: { b: ["x", "y", "z"] } });
		});

		it("merges duplicate bracket-indexed keys at the same slot", () => {
			const fd = new FormData();
			fd.append("a[0]", "x");
			fd.append("a[0]", "y");
			expect(parser.parse(fd)).toEqual({ a: [["x", "y"]] });
		});
	});

	describe("prototype safety", () => {
		it("does not pollute Object.prototype via __proto__ key", () => {
			const fd = new FormData();
			fd.set("__proto__.polluted", "yes");
			parser.parse(fd);
			// @ts-expect-error intentional probe
			expect({}.polluted).toBeUndefined();
		});

		it("does not pollute Object.prototype via nested __proto__ key", () => {
			const fd = new FormData();
			fd.set("a.__proto__.polluted", "yes");
			parser.parse(fd);
			// @ts-expect-error intentional probe
			expect({}.polluted).toBeUndefined();
		});

		it("produces null-prototype root object", () => {
			const fd = new FormData();
			fd.set("x", "1");
			const result = parser.parse(fd);
			expect(Object.getPrototypeOf(result)).toBeNull();
		});

		it("produces null-prototype nested objects", () => {
			const fd = new FormData();
			fd.set("a.b.c", "deep");
			const result = parser.parse(fd) as { a: { b: {} } };
			expect(Object.getPrototypeOf(result.a)).toBeNull();
			expect(Object.getPrototypeOf(result.a.b)).toBeNull();
		});
	});
});

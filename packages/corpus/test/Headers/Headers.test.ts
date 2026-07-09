import { describe, expect, it } from "bun:test";

// imported for the side effect of applying the Headers augmentation
import "../_modules";

describe("Headers augmentation", () => {
	describe("set", () => {
		it("COERCES NUMBERS", () => {
			const headers = new Headers();
			headers.set("content-length", 1024);

			expect(headers.get("content-length")).toBe("1024");
		});

		it("COERCES BOOLEANS", () => {
			const headers = new Headers();
			headers.set("x-cache-hit", true);
			headers.set("x-fresh", false);

			expect(headers.get("x-cache-hit")).toBe("true");
			expect(headers.get("x-fresh")).toBe("false");
		});

		it("KEEPS PLAIN STRING BEHAVIOR", () => {
			const headers = new Headers();
			headers.set("x-a", "1");
			headers.set("x-a", "2");

			expect(headers.get("x-a")).toBe("2");
		});
	});

	describe("append", () => {
		it("APPENDS A SINGLE VALUE", () => {
			const headers = new Headers();
			headers.append("x-a", "1");
			headers.append("x-a", "2");

			expect(headers.get("x-a")).toBe("1, 2");
		});

		it("APPENDS EACH ARRAY ITEM SEPARATELY", () => {
			const headers = new Headers();
			headers.append("set-cookie", ["a=1; Path=/", "b=2; Path=/"]);

			expect(headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
		});
	});

	describe("get / has / delete", () => {
		it("GET IS CASE INSENSITIVE", () => {
			const headers = new Headers();
			headers.set("X-Custom-Header", "v");

			expect(headers.get("X-Custom-Header")).toBe("v");
			expect(headers.get("x-custom-header")).toBe("v");
			expect(headers.get("X-CUSTOM-HEADER")).toBe("v");
		});

		it("GET RETURNS NULL FOR MISSING", () => {
			const headers = new Headers();

			expect(headers.get("x-missing")).toBeNull();
		});

		it("HAS IS CASE INSENSITIVE", () => {
			const headers = new Headers();
			headers.set("X-Custom-Header", "v");

			expect(headers.has("x-custom-header")).toBe(true);
			expect(headers.has("X-CUSTOM-HEADER")).toBe(true);
			expect(headers.has("x-missing")).toBe(false);
		});

		it("DELETE REMOVES THE HEADER", () => {
			const headers = new Headers();
			headers.set("x-a", "1");
			headers.delete("x-a");

			expect(headers.has("x-a")).toBe(false);
		});
	});

	describe("setMany", () => {
		it("SETS FROM A RECORD", () => {
			const headers = new Headers();
			headers.setMany({ "x-a": "1", "x-b": "2" });

			expect(headers.get("x-a")).toBe("1");
			expect(headers.get("x-b")).toBe("2");
		});

		it("SETS FROM ENTRIES", () => {
			const headers = new Headers();
			headers.setMany([
				["x-a", "1"],
				["x-b", "2"],
			]);

			expect(headers.get("x-a")).toBe("1");
			expect(headers.get("x-b")).toBe("2");
		});

		it("SKIPS EMPTY AND WHITESPACE VALUES", () => {
			const headers = new Headers();
			headers.setMany({ "x-a": "1", "x-empty": "", "x-blank": "   " });

			expect(headers.get("x-a")).toBe("1");
			expect(headers.has("x-empty")).toBe(false);
			expect(headers.has("x-blank")).toBe(false);
		});

		it("OVERWRITES INSTEAD OF APPENDING", () => {
			const headers = new Headers();
			headers.set("x-a", "old");
			headers.setMany({ "x-a": "new" });

			expect(headers.get("x-a")).toBe("new");
		});

		it("DOES NOT CLEAR AN EXISTING HEADER WITH AN EMPTY VALUE", () => {
			// documents current behavior: empty values are skipped, not deleted
			const headers = new Headers();
			headers.set("x-a", "keep");
			headers.setMany({ "x-a": "" });

			expect(headers.get("x-a")).toBe("keep");
		});
	});

	describe("mergeWith", () => {
		it("COPIES HEADERS FROM SOURCE", () => {
			const target = new Headers({ "x-a": "1" });
			const source = new Headers({ "x-b": "2" });

			target.mergeWith(source);
			expect(target.get("x-a")).toBe("1");
			expect(target.get("x-b")).toBe("2");
		});

		it("SOURCE OVERWRITES TARGET", () => {
			const target = new Headers({ "x-a": "old" });
			const source = new Headers({ "x-a": "new" });

			target.mergeWith(source);
			expect(target.get("x-a")).toBe("new");
		});

		it("SET COOKIE IS APPENDED NOT OVERWRITTEN", () => {
			const target = new Headers();
			const source = new Headers();
			target.append("set-cookie", "a=1; Path=/");
			source.append("set-cookie", "b=2; Path=/");

			target.mergeWith(source);
			expect(target.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
		});

		it("EMPTY SOURCE IS A NO OP", () => {
			const target = new Headers({ "x-a": "1" });

			target.mergeWith(new Headers());
			expect(target.get("x-a")).toBe("1");
		});
	});
});

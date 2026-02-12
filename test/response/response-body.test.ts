import { describe, expect, it } from "bun:test";
import { reqMaker } from "../utils/reqMaker";
import { pathMaker } from "../utils/pathMaker";
import { Route } from "@/internal/modules/Route/Route";
import { Server } from "@/exports";

const s = new Server({});
const prefix = "/response-body";
const path = pathMaker(prefix);
const req = reqMaker(prefix);

describe("Response Body", () => {
	it("STRING", async () => {
		new Route({ method: "GET", path: path("/string") }, () => "world");
		const res = await s.handle(req("/string", { method: "GET" }));
		expect(await res.text()).toBe("world");
	});

	it("NUMBER", async () => {
		new Route({ method: "GET", path: path("/number") }, () => 8);
		const res = await s.handle(req("/number", { method: "GET" }));
		expect(await res.text().then((data) => parseInt(data))).toBe(8);
	});

	it("JSON", async () => {
		new Route({ method: "GET", path: path("/json") }, () => ({
			hello: "world",
			object: 1,
		}));
		const res = await s.handle(req("/json", { method: "GET" }));
		expect(await res.json()).toEqual({
			hello: "world",
			object: 1,
		});
	});

	it("BOOLEAN", async () => {
		new Route({ method: "GET", path: path("/true") }, () => true);
		new Route({ method: "GET", path: path("/false") }, () => false);

		const resTrue = await s.handle(req("/true", { method: "GET" }));
		const resFalse = await s.handle(req("/false", { method: "GET" }));

		expect(await resTrue.text()).toBe("true");
		expect(await resFalse.text()).toBe("false");
	});

	it("NULL", async () => {
		new Route({ method: "GET", path: path("/null") }, () => null);
		const res = await s.handle(req("/null", { method: "GET" }));
		expect(await res.text()).toBe("");
	});

	it("UNDEFINED", async () => {
		new Route({ method: "GET", path: path("/undefined") }, () => undefined);
		const res = await s.handle(req("/undefined", { method: "GET" }));
		expect(await res.text()).toBe("");
	});

	it("ARRAY", async () => {
		new Route({ method: "GET", path: path("/array") }, () => [
			1,
			2,
			3,
			"test",
			{ nested: "object" },
		]);
		const res = await s.handle(req("/array", { method: "GET" }));
		const data = await res.json();
		expect(data).toEqual([1, 2, 3, "test", { nested: "object" }]);
		expect(data).toBeArrayOfSize(5);
	});

	it("NESTED OBJECT", async () => {
		new Route({ method: "GET", path: path("/nested") }, () => ({
			level1: {
				level2: {
					level3: "deep",
					array: [1, 2, 3],
					nestedArray: [{ id: 1 }, { id: 2 }],
				},
			},
		}));
		const res = await s.handle(req("/nested", { method: "GET" }));
		expect(await res.json()).toEqual({
			level1: {
				level2: {
					level3: "deep",
					array: [1, 2, 3],
					nestedArray: [{ id: 1 }, { id: 2 }],
				},
			},
		});
	});

	it("DATE OBJECT", async () => {
		const fixedDate = new Date("2024-01-01T00:00:00.000Z");
		new Route({ method: "GET", path: path("/date") }, () => fixedDate);
		const res = await s.handle(req("/date", { method: "GET" }));
		const data = await res.text();
		expect(data).toBe(fixedDate.toISOString());
		expect(new Date(data)).toBeDate();
	});

	it("BIGINT", async () => {
		new Route({ method: "GET", path: path("/bigint") }, () =>
			BigInt(12345678901234567890n),
		);
		const res = await s.handle(req("/bigint", { method: "GET" }));
		expect(await res.text()).toBe("12345678901234567890");
	});

	it("FUNCTION THAT RETURNS PROMISE", async () => {
		new Route({ method: "GET", path: path("/async") }, async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "async result";
		});
		const res = await s.handle(req("/async", { method: "GET" }));
		expect(await res.text()).toBe("async result");
	});

	it("EMPTY STRING", async () => {
		new Route({ method: "GET", path: path("/empty") }, () => "");
		const res = await s.handle(req("/empty", { method: "GET" }));
		expect(await res.text()).toBe("");
	});

	it("SPECIAL CHARACTERS IN STRING", async () => {
		new Route(
			{ method: "GET", path: path("/special") },
			() => 'Hello\nWorld\t"Quotes"\\Backslash🚀Emoji',
		);
		const res = await s.handle(req("/special", { method: "GET" }));
		expect(await res.text()).toBe('Hello\nWorld\t"Quotes"\\Backslash🚀Emoji');
	});

	it("ZERO AND NEGATIVE NUMBERS", async () => {
		new Route({ method: "GET", path: path("/zero") }, () => 0);
		new Route({ method: "GET", path: path("/negative") }, () => -42.5);

		const resZero = await s.handle(req("/zero", { method: "GET" }));
		const dataZero = await resZero.text();
		expect(dataZero).toBe("0");
		expect(parseInt(dataZero)).toBe(0);
		expect(parseFloat(dataZero)).toBe(0);

		const resNegative = await s.handle(req("/negative", { method: "GET" }));
		const dataNegative = await resNegative.text();
		expect(dataNegative).toBe("-42.5");
		expect(parseInt(dataNegative)).toBe(-42);
		expect(parseFloat(dataNegative)).toBe(-42.5);
	});
});

import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC, type CookieOptions } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

describe("Cookies", () => {
	const firstName = "firstCookie";
	const firstValue = "firstValue";
	const firstCookie: CookieOptions = {
		value: firstValue,
		name: firstName,
		domain: "localhost",
		path: "/",
	};
	const secondName = "secondCookie";
	const secondValue = "secondValue";
	const secondCookie: CookieOptions = {
		value: secondValue,
		name: secondName,
		domain: "localhost",
		path: "/",
	};

	function expectMethods(cookies: TC.Cookies, count: number = 1) {
		expect(cookies.count).toBe(count);
		expect(cookies.get(firstName)).toBe(firstValue);
		expect(cookies.has(firstName)).toBeTrue();
		expect(cookies.toSetCookieHeaders()).toBeArrayOfSize(count);
		cookies.delete(firstName);
		expect(cookies.count).toBe(count - 1);
		expect(cookies.get(firstName)).toBeNull();
		expect(cookies.has(firstName)).toBeFalse();
		expect(cookies.toSetCookieHeaders()).toBeArrayOfSize(count);
	}

	it("INIT - SINGLE", () => {
		const cookies = new TC.Cookies(firstCookie);
		expectMethods(cookies);
	});

	it("INIT - ARRAY", () => {
		const cookies = new TC.Cookies([firstCookie, secondCookie]);
		expectMethods(cookies, 2);
	});

	it("INIT - COOKIES - INNER INIT SINGLE", () => {
		const cookies = new TC.Cookies(new TC.Cookies(firstCookie));
		expectMethods(cookies);
	});

	it("INIT - COOKIES - INNER INIT ARRAY", () => {
		const cookies = new TC.Cookies(new TC.Cookies([firstCookie, secondCookie]));
		expectMethods(cookies, 2);
	});

	it("SET", () => {
		const cookies = new TC.Cookies();
		cookies.set(firstCookie);
		expectMethods(cookies);
	});

	it("SETMANY", () => {
		const cookies = new TC.Cookies();
		cookies.setMany([firstCookie, secondCookie]);
		expectMethods(cookies, 2);
	});

	it("KEYS", () => {
		const cookies = new TC.Cookies([firstCookie, secondCookie]);
		const keys = cookies.keys();
		expect(keys).toBeArrayOfSize(2);
		expect(keys).toContain(firstName);
		expect(keys).toContain(secondName);
	});

	it("VALUES", () => {
		const cookies = new TC.Cookies([firstCookie, secondCookie]);
		const values = cookies.values();
		expect(values).toBeArrayOfSize(2);
		expect(values).toContain(firstValue);
		expect(values).toContain(secondValue);
	});

	it("ENTRIES", () => {
		const cookies = new TC.Cookies([firstCookie, secondCookie]);
		const entries = [...cookies.entries()];
		expect(entries).toBeArrayOfSize(2);
		expect(entries.find(([k]) => k === firstName)?.[1]).toBe(firstValue);
		expect(entries.find(([k]) => k === secondName)?.[1]).toBe(secondValue);
	});

	it("COUNT - EMPTY", () => {
		const cookies = new TC.Cookies();
		expect(cookies.count).toBe(0);
	});

	it("DELETE - NON-EXISTENT", () => {
		const cookies = new TC.Cookies();
		expect(() => cookies.delete("ghost")).not.toThrow();
		expect(cookies.count).toBe(0);
	});

	it("SET - OVERWRITES EXISTING", () => {
		const cookies = new TC.Cookies(firstCookie);
		cookies.set({ ...firstCookie, value: "newValue" });
		expect(cookies.count).toBe(1);
		expect(cookies.get(firstName)).toBe("newValue");
	});

	it("TOSETCOOKIEHEADERS - EMPTY", () => {
		const cookies = new TC.Cookies();
		expect(cookies.toSetCookieHeaders()).toBeArrayOfSize(0);
	});

	it("TOSETCOOKIEHEADERS - CONTAINS COOKIE NAME", () => {
		const cookies = new TC.Cookies(firstCookie);
		const headers = cookies.toSetCookieHeaders();
		expect(headers[0]).toContain(firstName);
		expect(headers[0]).toContain(firstValue);
	});

	it("INIT - EMPTY", () => {
		const cookies = new TC.Cookies();
		expect(cookies.count).toBe(0);
		expect(cookies.keys()).toBeArrayOfSize(0);
		expect(cookies.values()).toBeArrayOfSize(0);
		expect(cookies.toSetCookieHeaders()).toBeArrayOfSize(0);
	});

	it("ENCODED URL STRINGS ARE NOT DECODED", async () => {
		const s = createTestServer();
		new TC.Route("/url-cookie", (c) => c.cookies.get("username"));
		const r = req("/url-cookie", {
			headers: { cookie: `username=${encodeURIComponent("Ozan Arslan")}` },
		});
		const res = await s.handle(r);
		expect(res.text()).resolves.toBe(encodeURIComponent("Ozan Arslan"));
	});
});

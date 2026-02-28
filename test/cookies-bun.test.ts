import { CookiesUsingBun } from "@/Cookies/CookiesUsingBun";
import type { CookieOptions } from "@/Cookies/types/CookieOptions";
import { describe, expect, it } from "bun:test";

describe("CookiesUsingBun", () => {
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

	function expectMethods(cookies: CookiesUsingBun, count: number = 1) {
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
		const cookies = new CookiesUsingBun(firstCookie);
		expectMethods(cookies);
	});

	it("INIT - ARRAY", () => {
		const cookies = new CookiesUsingBun([firstCookie, secondCookie]);
		expectMethods(cookies, 2);
	});

	it("INIT - COOKIES - INNER INIT SINGLE", () => {
		const cookies = new CookiesUsingBun(new CookiesUsingBun(firstCookie));
		expectMethods(cookies);
	});

	it("INIT - COOKIES - INNER INIT ARRAY", () => {
		const cookies = new CookiesUsingBun(
			new CookiesUsingBun([firstCookie, secondCookie]),
		);
		expectMethods(cookies, 2);
	});

	it("SET", () => {
		const cookies = new CookiesUsingBun();
		cookies.set(firstCookie);
		expectMethods(cookies);
	});

	it("SETMANY", () => {
		const cookies = new CookiesUsingBun();
		cookies.setMany([firstCookie, secondCookie]);
		expectMethods(cookies, 2);
	});
});

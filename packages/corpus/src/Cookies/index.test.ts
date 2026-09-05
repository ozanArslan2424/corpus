import { describe, expect, it } from "bun:test";

import { Cookies, parseCookieHeader, parseSetCookieHeaders } from "@/Cookies";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0=";

describe("parseCookieHeader", () => {
	it("parses a single pair into one Cookie", () => {
		const [cookie, ...rest] = parseCookieHeader("a=1");
		expect(rest).toHaveLength(0);
		expect(cookie?.name).toBe("a");
		expect(cookie?.value).toBe("1");
	});

	it("parses every pair in a multi-cookie header, in order", () => {
		const cookies = parseCookieHeader("a=1; b=2; c=3");
		expect(cookies.map((cookie) => cookie.name)).toEqual(["a", "b", "c"]);
		expect(cookies.map((cookie) => cookie.value)).toEqual(["1", "2", "3"]);
	});

	it("parses pairs with no whitespace after the separator", () => {
		const cookies = parseCookieHeader("a=1;b=2");
		expect(cookies.map((cookie) => cookie.value)).toEqual(["1", "2"]);
	});

	it("preserves '=' characters inside a value", () => {
		const [cookie] = parseCookieHeader(`token=${JWT}`);
		expect(cookie?.value).toBe(JWT);
	});

	it("parses a pair with an empty value", () => {
		const cookies = parseCookieHeader("a=; b=2");
		expect(cookies.map((cookie) => cookie.name)).toEqual(["a", "b"]);
		expect(cookies[0]?.value).toBe("");
	});

	it("skips segments that contain no '='", () => {
		const cookies = parseCookieHeader("a=1; malformed; b=2");
		expect(cookies.map((cookie) => cookie.name)).toEqual(["a", "b"]);
	});

	it("returns an empty array for an empty header", () => {
		expect(parseCookieHeader("")).toEqual([]);
	});

	it("returns an empty array for a header with no valid pairs", () => {
		expect(parseCookieHeader("; ;")).toEqual([]);
	});
});

describe("parseSetCookieHeaders", () => {
	it("parses one Cookie per header string", () => {
		const cookies = parseSetCookieHeaders(["a=1; Path=/", "b=2; Path=/admin"]);
		expect(cookies.map((cookie) => cookie.name)).toEqual(["a", "b"]);
		expect(cookies.map((cookie) => cookie.value)).toEqual(["1", "2"]);
	});

	it("parses the attributes of each header onto its own Cookie", () => {
		const [session, tracker] = parseSetCookieHeaders([
			"session=abc; Path=/admin; HttpOnly",
			"tracker=xyz; Path=/; Secure",
		]);
		expect(session?.path).toBe("/admin");
		expect(session?.httpOnly).toBe(true);
		expect(session?.secure).toBe(false);
		expect(tracker?.path).toBe("/");
		expect(tracker?.secure).toBe(true);
		expect(tracker?.httpOnly).toBe(false);
	});

	it("returns an empty array for an empty input", () => {
		expect(parseSetCookieHeaders([])).toEqual([]);
	});
});

describe("Cookies.fromHeader", () => {
	it("parses a single cookie", () => {
		expect(Cookies.fromHeader("a=1").get("a")).toBe("1");
	});

	it("parses multiple cookies separated by semicolons", () => {
		expect(Cookies.fromHeader("a=1; b=2; c=3").toJSON()).toEqual({ a: "1", b: "2", c: "3" });
	});

	it("preserves '=' characters inside a value", () => {
		const cookies = Cookies.fromHeader(`token=${JWT}; a=1`);
		expect(cookies.get("token")).toBe(JWT);
		expect(cookies.get("a")).toBe("1");
	});

	it("skips malformed segments rather than throwing", () => {
		expect(Cookies.fromHeader("a=1; malformed; b=2").toJSON()).toEqual({ a: "1", b: "2" });
	});

	it("keeps the last occurrence when a name is repeated", () => {
		expect(Cookies.fromHeader("a=1; a=2").get("a")).toBe("2");
	});

	it("matches the Cookie header produced by a real Request", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "a=1; b=2; c=3" } });
		const cookies = Cookies.fromHeader(req.headers.get("Cookie") ?? "");
		expect(cookies.toJSON()).toEqual({ a: "1", b: "2", c: "3" });
	});

	it("returns an empty Cookies instance for an empty header", () => {
		expect(Cookies.fromHeader("").toJSON()).toEqual({});
	});

	it("returns a Cookies instance, not a bare CookieMap", () => {
		expect(Cookies.fromHeader("a=1")).toBeInstanceOf(Cookies);
	});
});

describe("Cookies.fromSetCookieHeaders", () => {
	it("parses a single Set-Cookie header into name and value", () => {
		const cookies = Cookies.fromSetCookieHeaders([
			"hello=world; Domain=hello; Path=/; SameSite=Lax",
		]);
		expect(cookies.get("hello")).toBe("world");
	});

	it("carries every attribute through onto the stored cookie", () => {
		const cookies = Cookies.fromSetCookieHeaders([
			"session=abc; Path=/admin; Domain=example.com; SameSite=Strict; Secure; HttpOnly; Max-Age=600",
		]);
		const [header] = cookies.toSetCookieHeaders();
		const cookie = Bun.Cookie.parse(header ?? "");
		expect(cookie.value).toBe("abc");
		expect(cookie.path).toBe("/admin");
		expect(cookie.domain).toBe("example.com");
		expect(cookie.sameSite).toBe("strict");
		expect(cookie.secure).toBe(true);
		expect(cookie.httpOnly).toBe(true);
		expect(cookie.maxAge).toBe(600);
	});

	it("keeps each cookie's attributes separate from the others'", () => {
		const cookies = Cookies.fromSetCookieHeaders([
			"hello=world; Domain=hello; Path=/one; HttpOnly",
			"hello2=world2; Domain=hello2; Path=/two",
		]);
		const parsed = cookies
			.toSetCookieHeaders()
			.map((header) => Bun.Cookie.parse(header))
			.reduce<Record<string, Bun.Cookie>>((acc, cookie) => {
				acc[cookie.name] = cookie;
				return acc;
			}, {});

		expect(parsed.hello?.domain).toBe("hello");
		expect(parsed.hello?.path).toBe("/one");
		expect(parsed.hello?.httpOnly).toBe(true);
		expect(parsed.hello2?.domain).toBe("hello2");
		expect(parsed.hello2?.path).toBe("/two");
		expect(parsed.hello2?.httpOnly).toBe(false);
	});

	it("keeps multiple cookies' names and values distinct", () => {
		const cookies = Cookies.fromSetCookieHeaders([
			"hello=world; Domain=hello",
			"hello2=world2; Domain=hello2",
		]);
		expect(cookies.toJSON()).toEqual({ hello: "world", hello2: "world2" });
	});

	it("does not lose data the way parsing a ', '-joined Set-Cookie string would", () => {
		// Headers.get(Set-Cookie) joins multiple entries with ", ", which is not a
		// safe separator to re-split on - each entry contains its own "; "-separated
		// attributes. getSetCookie() hands back one complete string per cookie, which
		// is why fromSetCookieHeaders takes an array. Pinning this so nobody
		// simplifies it back down to a single joined header + fromHeader.
		const headers = ["hello=world; Domain=hello", "hello2=world2; Domain=hello2"];
		expect(Cookies.fromSetCookieHeaders(headers).toJSON()).toEqual({
			hello: "world",
			hello2: "world2",
		});
		expect(Cookies.fromHeader(headers.join(", ")).toJSON()).not.toEqual({
			hello: "world",
			hello2: "world2",
		});
	});

	it("returns an empty Cookies instance for an empty array", () => {
		expect(Cookies.fromSetCookieHeaders([]).toJSON()).toEqual({});
	});

	it("returns a Cookies instance, not a bare CookieMap", () => {
		expect(Cookies.fromSetCookieHeaders(["a=1"])).toBeInstanceOf(Cookies);
	});
});

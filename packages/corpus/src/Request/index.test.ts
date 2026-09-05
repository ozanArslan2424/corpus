import { beforeAll, describe, expect, it } from "bun:test";

import { Cookies } from "@/Cookies";
import { patchGlobalRequest } from "@/Request";

// patchGlobalRequest() mutates globalThis.Request for the entire process and is
// NOT idempotent (each call re-wraps whatever Request currently is) - call it
// exactly once here. If other test files also call it, run order matters and
// could double-wrap Request; there's no unpatch/teardown provided by the source.
beforeAll(() => {
	patchGlobalRequest();
});

describe("patchGlobalRequest", () => {
	it("parses a single cookie from the Cookie header", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "name=Ozan" } });
		expect(req.cookies.get("name")).toBe("Ozan");
	});

	it("parses multiple cookies separated by semicolons", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "a=1; b=2" } });
		expect(req.cookies.get("a")).toBe("1");
		expect(req.cookies.get("b")).toBe("2");
	});

	it("returns an empty CookieMap when there is no Cookie header", () => {
		const req = new Request("http://localhost/");
		expect(req.cookies.size).toBe(0);
	});

	it("skips a pair with no '=' separator", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "malformed" } });
		expect(req.cookies.size).toBe(0);
	});

	it("skips a pair with an empty name", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "=value" } });
		expect(req.cookies.size).toBe(0);
	});

	it("skips a pair with an empty value", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "name=" } });
		expect(req.cookies.size).toBe(0);
	});

	it("still parses valid pairs alongside a malformed one", () => {
		const req = new Request("http://localhost/", {
			headers: { Cookie: "good=1; malformed; also=2" },
		});
		expect(req.cookies.get("good")).toBe("1");
		expect(req.cookies.get("also")).toBe("2");
		expect(req.cookies.size).toBe(2);
	});

	it("memoizes the same CookieMap instance across accesses", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "name=Ozan" } });
		const first = req.cookies;
		const second = req.cookies;
		expect(first).toBe(second);
	});

	it("merges a Cookie header on top of cookies already provided via init.cookies", () => {
		const provided = new Cookies();
		provided.set("preset", "yes");
		const req = new Request("http://localhost/", {
			cookies: provided as Cookies,
			headers: { Cookie: "fromHeader=1" },
		});
		expect(req.cookies.get("preset")).toBe("yes");
		expect(req.cookies.get("fromHeader")).toBe("1");
	});

	it("uses init.cookies directly (same instance) when no Cookie header is present", () => {
		const provided = new Cookies();
		provided.set("preset", "yes");
		const req = new Request("http://localhost/", { cookies: provided as Cookies });
		expect(req.cookies).toBe(provided);
	});

	it("allows replacing cookies via the setter", () => {
		const req = new Request("http://localhost/", { headers: { Cookie: "name=Ozan" } });
		const replacement = new Cookies();
		replacement.set("replaced", "true");
		req.cookies = replacement as Cookies;
		expect(req.cookies.get("replaced")).toBe("true");
		expect(req.cookies.get("name")).toBeNull();
	});
});

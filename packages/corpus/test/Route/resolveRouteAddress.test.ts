import { describe, expect, it } from "bun:test";

import { Method } from "@/enums/Method";
import { resolveRouteAddress } from "@/Route/resolveRouteAddress";

describe("resolveRouteAddress", () => {
	it("PLAIN PATH DEFAULTS TO GET", () => {
		expect(resolveRouteAddress("/users")).toEqual({
			method: Method.GET,
			path: "/users",
		});
	});

	it("PATH WITHOUT LEADING SLASH DEFAULTS TO GET", () => {
		expect(resolveRouteAddress("users")).toEqual({
			method: Method.GET,
			path: "users",
		});
	});

	it("OBJECT FORM PASSES THROUGH", () => {
		const address = { method: Method.POST, path: "/users" };

		expect(resolveRouteAddress(address)).toBe(address);
	});

	it("VERB PREFIXED STRING RESOLVES", () => {
		expect(resolveRouteAddress("POST /users")).toEqual({
			method: Method.POST,
			path: "/users",
		});
	});

	it("LOWERCASE VERB IS UPPERCASED", () => {
		expect(resolveRouteAddress("delete /users/:id")).toEqual({
			method: Method.DELETE,
			path: "/users/:id",
		});
	});

	it.each(Object.values(Method))("VERB %s RESOLVES", (method) => {
		expect(resolveRouteAddress(`${method} /x`)).toEqual({ method, path: "/x" });
	});

	it("THROWS ON NON VERB PREFIX", () => {
		expect(() => resolveRouteAddress("FOO /users")).toThrow();
	});

	it("THROWS ON PATH WITH INNER WHITESPACE", () => {
		expect(() => resolveRouteAddress("/users list")).toThrow();
	});

	it("THROWS ON VERB WITHOUT PATH", () => {
		// "GET " splits into ["GET", ""], "GET" alone has no space and is
		// treated as a plain path, so the trailing-space form is the throw case
		expect(() => resolveRouteAddress("GET ")).toThrow();
	});

	it("EXTRA SEGMENTS AFTER THE PATH ARE DROPPED", () => {
		// documents current behavior: split(" ") + destructuring keeps only
		// the first two parts, "GET /a /b" resolves to path "/a"
		expect(resolveRouteAddress("GET /a /b")).toEqual({
			method: Method.GET,
			path: "/a" as never,
		});
	});
});

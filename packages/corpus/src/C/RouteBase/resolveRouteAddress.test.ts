import { describe, expect, it } from "bun:test";

import { Method } from "@/C/Req/Method";
import { resolveRouteAddress } from "@/C/RouteBase/resolveRouteAddress";

describe("resolveRouteAddress", () => {
	it("plain path defaults to get", () => {
		expect(resolveRouteAddress("/users")).toEqual({
			method: Method.GET,
			path: "/users",
		});
	});

	it("path without leading slash defaults to get", () => {
		expect(resolveRouteAddress("users")).toEqual({
			method: Method.GET,
			path: "users",
		});
	});

	it("object form passes through", () => {
		const address = { method: Method.POST, path: "/users" };

		expect(resolveRouteAddress(address)).toBe(address);
	});

	it("verb prefixed string resolves", () => {
		expect(resolveRouteAddress("POST /users")).toEqual({
			method: Method.POST,
			path: "/users",
		});
	});

	it("lowercase verb is uppercased", () => {
		expect(resolveRouteAddress("delete /users/:id")).toEqual({
			method: Method.DELETE,
			path: "/users/:id",
		});
	});

	it.each(Object.values(Method))("verb %s resolves", (method) => {
		expect(resolveRouteAddress(`${method} /x`)).toEqual({ method, path: "/x" });
	});

	it("throws on non verb prefix", () => {
		expect(() => resolveRouteAddress("FOO /users")).toThrow();
	});

	it("throws on path with inner whitespace", () => {
		expect(() => resolveRouteAddress("/users list")).toThrow();
	});

	it("throws on verb without path", () => {
		// "GET " splits into ["GET", ""], "GET" alone has no space and is
		// treated as a plain path, so the trailing-space form is the throw case
		expect(() => resolveRouteAddress("GET ")).toThrow();
	});

	it("extra segments after the path are dropped", () => {
		// documents current behavior: split(" ") + destructuring keeps only
		// the first two parts, "GET /a /b" resolves to path "/a"
		expect(resolveRouteAddress("GET /a /b")).toEqual({
			method: Method.GET,
			path: "/a" as never,
		});
	});
});

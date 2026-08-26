import { describe, expect, it } from "bun:test";

import { joinPathSegments } from "@/C/RouteBase/joinPathSegments";

describe("joinPathSegments", () => {
	it("leading slashes", () => {
		expect(joinPathSegments("/hello", "/world")).toBe("/hello/world");
	});

	it("trailing slashes", () => {
		expect(joinPathSegments("hello/", "world/")).toBe("/hello/world");
	});

	it("leading and trailing slashes", () => {
		expect(joinPathSegments("/hello/", "/world/")).toBe("/hello/world");
	});

	it("no slashes", () => {
		expect(joinPathSegments("hello", "world")).toBe("/hello/world");
	});

	it("inner slashes", () => {
		expect(joinPathSegments("hello/world", "testing/this")).toBe("/hello/world/testing/this");
	});

	it("mixed slashes", () => {
		expect(joinPathSegments("hello/", "/world", "hello/world", "hello", "world")).toBe(
			"/hello/world/hello/world/hello/world",
		);
	});
});

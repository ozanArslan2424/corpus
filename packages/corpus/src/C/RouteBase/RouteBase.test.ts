import { afterEach, describe, expect, it } from "bun:test";

import { createTestServer } from "#testutils";
import { HeaderKey } from "@/C/Headers/HeaderKey";
import { Method } from "@/C/Req/Method";
import type { ContextHandler } from "@/C/Route/Route.types";
import { RouteBase } from "@/C/RouteBase/RouteBase";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());
createTestServer();

class TestRoute extends RouteBase {
	variant = "dynamic" as const;
	endpoint = "/users/:id";
	method = Method.GET;
	handler: ContextHandler<any, any, any, any> = (c) => ({
		params: c.params,
		body: c.body,
		search: c.search,
	});
}

describe("RouteBase", () => {
	it("builds the id from method and endpoint", () => {
		const route = new TestRoute();
		expect(route.id).toBe("GET /users/:id");
	});

	it("builds a request with substituted params, search, and a JSON body", () => {
		const route = new TestRoute();
		const req = route.request({
			params: { id: "42" },
			search: { active: "true" },
			body: { name: "Alice" },
		});

		expect(req.method).toBe(Method.GET);
		expect(new URL(req.url).pathname).toContain("/users/42");
		expect(new URL(req.url).searchParams.get("active")).toBe("true");
		expect(req.headers.get(HeaderKey.ContentType)).toBe("application/json");
	});

	it("builds a request with a FormData body without a JSON content type", () => {
		const route = new TestRoute();
		const form = new FormData();
		form.set("file", "content");
		const req = route.request({ body: form });

		expect(req.headers.get(HeaderKey.ContentType)).not.toBe("application/json");
	});

	it("passes body, params, and search through to the handler", async () => {
		const route = new TestRoute();
		const result = await route.handle({
			params: { id: "42" },
			body: { name: "Alice" },
			search: { active: "true" },
		});

		expect(result).toEqual({
			params: { id: "42" },
			body: { name: "Alice" },
			search: { active: "true" },
		});
	});
});

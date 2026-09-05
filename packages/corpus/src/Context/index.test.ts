import { beforeAll, describe, expect, it } from "bun:test";

import { Context } from "@/Context";
import { initialize } from "@/initialize";
import { Res } from "@/Res";
import type { Server } from "@/Server";

function makeReq(url: string, headers: Record<string, string> = {}): Request {
	return new Request(url, { headers });
}

beforeAll(() => {
	initialize();
});

describe("Context", () => {
	describe("construction", () => {
		it("stores the request and server", () => {
			const req = makeReq("http://localhost/test");
			const server = {} as Server;
			const ctx = new Context(req, server);
			expect(ctx.req).toBe(req);
			expect(ctx.req).toBeInstanceOf(Request);
			expect(ctx.server).toBe(server);
		});

		it("allows an undefined server", () => {
			const req = makeReq("http://localhost/test");
			const ctx = new Context(req, undefined);
			expect(ctx.server).toBeUndefined();
		});

		it("defaults body, params, search, and data to empty objects", () => {
			const ctx = new Context(makeReq("http://localhost/test"), undefined);
			expect(ctx.body).toEqual({});
			expect(ctx.params).toEqual({});
			expect(ctx.search).toEqual({});
			expect(ctx.data).toEqual({});
		});

		it("allows body, params, search, and data to be reassigned", () => {
			const ctx = new Context<{ a: number }>(makeReq("http://localhost/test"), undefined);
			ctx.body = { a: 1 };
			expect(ctx.body).toEqual({ a: 1 });
		});
	});

	describe("res", () => {
		it("lazily creates a Res instance", () => {
			const ctx = new Context(makeReq("http://localhost/test"), undefined);
			expect(ctx.res).toBeInstanceOf(Res);
		});

		it("memoizes the created Res across accesses", () => {
			const ctx = new Context(makeReq("http://localhost/test"), undefined);
			const first = ctx.res;
			const second = ctx.res;
			expect(first).toBe(second);
		});

		it("allows overriding res via the setter", () => {
			const ctx = new Context(makeReq("http://localhost/test"), undefined);
			const custom = new Res();
			ctx.res = custom;
			expect(ctx.res).toBe(custom);
		});
	});

	describe("url", () => {
		it("parses the request URL", () => {
			const ctx = new Context(makeReq("http://localhost/test?a=1"), undefined);
			expect(ctx.url).toBeInstanceOf(URL);
			expect(ctx.url.pathname).toBe("/test");
			expect(ctx.url.searchParams.get("a")).toBe("1");
		});

		it("memoizes the parsed URL across accesses", () => {
			const ctx = new Context(makeReq("http://localhost/test"), undefined);
			const first = ctx.url;
			const second = ctx.url;
			expect(first).toBe(second);
		});
	});
});

import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { parseBody } from "./utils/parse";
import { req } from "./utils/req";

beforeEach(() => {
	$registryTesting.reset();

	// ── routes ────────────────────────────────────────────────────────────────

	const authRoute = new TC.Route("/protected", (c) => ({
		user: (c.data as any).user,
	}));
	const throwRoute = new TC.Route("/throw-guarded", (c) => ({
		user: (c.data as any).user,
	}));
	const outboundHeaders = new TC.Route("/outbound-headers", () => ({
		ok: true,
	}));
	const outboundCookies = new TC.Route("/outbound-cookies", () => ({
		ok: true,
	}));
	new TC.Route("/global-one", (c) => ({ traced: (c.data as any).traced }));
	new TC.Route("/global-two", (c) => ({ traced: (c.data as any).traced }));
	const inboundHeaders = new TC.Route("/inbound-headers", (c) => ({
		receivedToken: (c.data as any).token,
	}));
	const inboundCookies = new TC.Route("/inbound-cookies", (c) => ({
		sessionId: (c.data as any).sessionId,
	}));

	// ── 1) return-response guard ───────────────────────────────────────────────
	// Simulates an auth guard: if the Authorization header is missing/wrong,
	// short-circuit with 401 before the route handler runs.
	new TC.Middleware({
		useOn: [authRoute],
		handler: (c) => {
			const token = c.req.headers.get("authorization");
			if (token !== "Bearer secret") {
				return new TC.Res({ error: "unauthorized" }, { status: 401 });
			}
			(c.data as any).user = "alice";
		},
	});

	// ── 2) throw guard ────────────────────────────────────────────────────────
	// Simulates a guard that throws (e.g. JWT verification failure).
	// The framework should catch it and respond with 500 (or your error shape).
	new TC.Middleware({
		useOn: [throwRoute],
		handler: () => {
			throw new Error("token signature invalid");
		},
	});

	// ── 3a) outbound — append response headers ────────────────────────────────
	// Simulates a CORS or cache-control interceptor running after the handler.
	new TC.Middleware({
		variant: "outbound",
		useOn: [outboundHeaders],
		handler: (c) => {
			c.res.headers.set("x-powered-by", "corpus");
			c.res.headers.set("cache-control", "no-store");
		},
	});

	// ── 3b) outbound — set cookies ────────────────────────────────────────────
	// Simulates a session middleware that stamps a cookie on every response.
	new TC.Middleware({
		variant: "outbound",
		useOn: [outboundCookies],
		handler: (c) => {
			c.res.cookies.set({
				name: "session",
				value: "abc123",
				httpOnly: true,
			});
		},
	});

	// ── 4) global middleware via useOn: "*" ───────────────────────────────────
	// Simulates a request-id / tracing interceptor applied to every route.
	new TC.Middleware({
		useOn: "*",
		handler: (c) => {
			(c.data as any).traced = true;
		},
	});

	// ── 5a) inbound — read request header ─────────────────────────────────────
	// Simulates an API-key extractor that normalises the token into (c.data as any).
	new TC.Middleware({
		useOn: [inboundHeaders],
		handler: (c) => {
			(c.data as any).token = c.req.headers.get("x-api-key") ?? null;
		},
	});

	// ── 5b) inbound — read request cookie ─────────────────────────────────────
	// Simulates a session resolver that reads a cookie and exposes the id.
	new TC.Middleware({
		useOn: [inboundCookies],
		handler: (c) => {
			(c.data as any).sessionId = c.req.cookies.get("session-id") ?? null;
		},
	});
});

describe("C.Middleware — lifecycle", () => {
	const s = createTestServer();

	// ── tests ─────────────────────────────────────────────────────────────────

	it("GUARD — return response blocks route (wrong token)", async () => {
		const res = await s.handle(req("/protected"));
		expect(res.status).toBe(401);
		const body = await parseBody<{ error: string }>(res);
		expect(body).toEqual({ error: "unauthorized" });
	});

	it("GUARD — return response passes through (correct token)", async () => {
		const res = await s.handle(req("/protected", { headers: { authorization: "Bearer secret" } }));
		expect(res.status).toBe(200);
		const body = await parseBody<{ user: string }>(res);
		expect(body).toEqual({ user: "alice" });
	});

	it("GUARD — throw short-circuits route", async () => {
		const res = await s.handle(req("/throw-guarded"));
		expect(res.status).toBe(500);
	});

	it("OUTBOUND — response headers are set after handler", async () => {
		const res = await s.handle(req("/outbound-headers"));
		expect(res.headers.get("x-powered-by")).toBe("corpus");
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("OUTBOUND — cookies are set on response", async () => {
		const res = await s.handle(req("/outbound-cookies"));
		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toInclude("session=abc123");
		expect(setCookie).toInclude("HttpOnly");
	});

	it("GLOBAL — useOn '*' runs on every route", async () => {
		const res1 = await s.handle(req("/global-one"));
		const res2 = await s.handle(req("/global-two"));
		const body1 = await parseBody<{ traced: boolean }>(res1);
		const body2 = await parseBody<{ traced: boolean }>(res2);
		expect(body1).toEqual({ traced: true });
		expect(body2).toEqual({ traced: true });
	});

	it("INBOUND — request header extracted into (c.data as any)", async () => {
		const res = await s.handle(req("/inbound-headers", { headers: { "x-api-key": "key-xyz" } }));
		const body = await parseBody<{ receivedToken: string }>(res);
		expect(body).toEqual({ receivedToken: "key-xyz" });
	});

	it("INBOUND — request cookie extracted into (c.data as any)", async () => {
		const res = await s.handle(
			req("/inbound-cookies", { headers: { cookie: "session-id=sess-99" } }),
		);
		const body = await parseBody<{ sessionId: string }>(res);
		expect(body).toEqual({ sessionId: "sess-99" });
	});
});

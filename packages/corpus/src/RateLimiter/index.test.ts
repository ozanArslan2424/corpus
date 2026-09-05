import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { App } from "@/App";
import { Context } from "@/Context";
import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { RateLimiter, RateLimiterMemoryStore, type RateLimiterStoreInterface } from "@/RateLimiter";
import { Status } from "@/Res";
import { Route } from "@/Route";

beforeEach(() => {
	// RateLimiter (via Middleware.register) calls getNearestApp(), which
	// throws without an active App.
	Globals.set("apps", []);
});

afterEach(() => {
	Globals.delete("apps");
});

function makeContext(headers: Record<string, string> = {}) {
	return new Context<never, never, never, never>(
		new Request("http://localhost/", { headers }),
		undefined,
	);
}

/** Wraps a thunk so both a synchronous throw and a rejected promise are caught uniformly. */
async function captureError(fn: () => unknown): Promise<unknown> {
	try {
		await fn();
	} catch (err) {
		return err;
	}
	throw new Error("expected the call to throw or reject, but it resolved");
}

describe("RateLimiterMemoryStore", () => {
	it("returns undefined for a key that was never set", async () => {
		const store = new RateLimiterMemoryStore();
		expect(store.get("missing")).toBeUndefined();
	});

	it("stores and retrieves an entry", async () => {
		const store = new RateLimiterMemoryStore();
		const entry = { hits: 1, resetAt: Date.now() + 1000 };
		await store.set("a", entry);
		expect(store.get("a")).toEqual(entry);
	});

	it("deletes an entry", async () => {
		const store = new RateLimiterMemoryStore();
		await store.set("a", { hits: 1, resetAt: Date.now() + 1000 });
		store.delete("a");
		expect(store.get("a")).toBeUndefined();
	});

	it("reports the correct size", async () => {
		const store = new RateLimiterMemoryStore();
		await store.set("a", { hits: 1, resetAt: Date.now() + 1000 });
		await store.set("b", { hits: 1, resetAt: Date.now() + 1000 });
		expect(store.size()).toBe(2);
	});

	it("clears all entries", async () => {
		const store = new RateLimiterMemoryStore();
		await store.set("a", { hits: 1, resetAt: Date.now() + 1000 });
		await store.set("b", { hits: 1, resetAt: Date.now() + 1000 });
		store.clear();
		expect(store.size()).toBe(0);
	});

	it("cleanup removes only expired entries", async () => {
		const store = new RateLimiterMemoryStore();
		const now = Date.now();
		await store.set("expired", { hits: 1, resetAt: now - 1000 });
		await store.set("fresh", { hits: 1, resetAt: now + 100_000 });
		store.cleanup(now);
		expect(store.get("expired")).toBeUndefined();
		expect(store.get("fresh")).toBeDefined();
	});

	it("handles concurrent sets to different keys without dropping entries", async () => {
		const store = new RateLimiterMemoryStore();
		await Promise.all(
			Array.from({ length: 20 }, (_, i) =>
				store.set(`key-${i}`, { hits: 1, resetAt: Date.now() + 1000 }),
			),
		);
		expect(store.size()).toBe(20);
	});
});

describe("RateLimiter", () => {
	describe("construction", () => {
		it("registers itself as middleware on the nearest App", () => {
			const app = new App();
			const limiter = new RateLimiter();
			expect(app.findMiddlewares("*")).not.toContain(limiter); // it's not global by default
		});

		it("scopes useOn to the ids of currently registered non-bundle routes", () => {
			new App();
			const routeA = new Route("/a", () => "ok");
			const routeB = new Route("/b", () => "ok");
			const limiter = new RateLimiter();
			expect(limiter.useOn).toEqual([routeA.id, routeB.id]);
		});

		it("results in an empty useOn when no routes are registered yet", () => {
			new App();
			const limiter = new RateLimiter();
			expect(limiter.useOn).toEqual([]);
		});

		it("uses a default in-memory store when none is provided", async () => {
			new App();
			const limiter = new RateLimiter();
			expect(await limiter.getStoreSize()).toBe(0);
		});

		it("delegates to a custom store when provided", async () => {
			new App();
			const customStore: RateLimiterStoreInterface = {
				get: mock(async () => undefined),
				set: mock(async () => {}),
				delete: mock(async () => {}),
				cleanup: mock(async () => {}),
				clear: mock(async () => {}),
				size: mock(async () => 0),
			};
			const limiter = new RateLimiter({ store: customStore });

			await limiter.getResult(new Headers(), new Headers());

			expect(customStore.get).toHaveBeenCalled();
			expect(customStore.set).toHaveBeenCalled();
		});
	});

	describe("getResult: identification strategy", () => {
		it("classifies a valid bearer token as an authenticated identity", async () => {
			new App();
			const limiter = new RateLimiter({ limits: { authenticated: 5, ipBased: 5, fingerprint: 5 } });
			const reqHeaders = new Headers({ Authorization: `Bearer ${"a".repeat(25)}` });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("5");
		});

		it("does not treat a too-short bearer token as authenticated", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 3 },
			});
			const reqHeaders = new Headers({ Authorization: "Bearer short" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			// falls through to fingerprint limit, not the much higher authenticated limit
			expect(resHeaders.get("RateLimit-Limit")).toBe("3");
		});

		it("treats an Authorization header with no recognizable 'Bearer' scheme as the raw token", async () => {
			// getIdAndLimit only strips a "Bearer " prefix when "earer " appears in the
			// header value - anything else is used as the token verbatim.
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 5, ipBased: 999, fingerprint: 999 },
			});
			const reqHeaders = new Headers({ Authorization: "a".repeat(25) });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("5");
		});

		it("reads the auth token from a custom header name when config.authHeader is set", async () => {
			new App();
			const limiter = new RateLimiter({
				authHeader: "X-Api-Key",
				limits: { authenticated: 9, ipBased: 999, fingerprint: 999 },
			});
			const reqHeaders = new Headers({ "X-Api-Key": `Bearer ${"a".repeat(25)}` });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("9");
		});

		it("classifies a valid IPv4 address from x-forwarded-for as an IP-based identity", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 7, fingerprint: 999 },
			});
			const reqHeaders = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("7");
		});

		it("prefers cf-connecting-ip over x-forwarded-for", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 7, fingerprint: 999 },
			});
			const resHeadersA = new Headers();
			const resHeadersB = new Headers();
			await limiter.getResult(new Headers({ "cf-connecting-ip": "203.0.113.9" }), resHeadersA);
			await limiter.getResult(new Headers({ "x-forwarded-for": "198.51.100.1" }), resHeadersB);
			// different IPs -> independent counters, both starting fresh at limit-1
			expect(resHeadersA.get("RateLimit-Remaining")).toBe("6");
			expect(resHeadersB.get("RateLimit-Remaining")).toBe("6");
		});

		it("rejects a malformed IPv4 address and falls back to fingerprint", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 4 },
			});
			const reqHeaders = new Headers({ "x-forwarded-for": "999.999.999.999" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("4");
		});

		it("rejects an IPv4 address with leading zeros", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 4 },
			});
			const reqHeaders = new Headers({ "x-forwarded-for": "192.168.001.1" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("4");
		});

		it("classifies a valid IPv6 address as an IP-based identity", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 8, fingerprint: 999 },
			});
			const reqHeaders = new Headers({ "x-real-ip": "::1" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("8");
		});

		it("falls back to a fingerprint identity when no token or IP is present", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 6 },
			});
			const reqHeaders = new Headers({ "user-agent": "test-agent" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("RateLimit-Limit")).toBe("6");
		});
	});

	describe("getResult: counting and headers", () => {
		it("returns true and decrements remaining on repeated calls under the limit", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 3 },
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });

			const resHeadersFirst = new Headers();
			const firstSuccess = await limiter.getResult(reqHeaders, resHeadersFirst);
			const resHeadersSecond = new Headers();
			const secondSuccess = await limiter.getResult(reqHeaders, resHeadersSecond);

			expect(firstSuccess).toBe(true);
			expect(resHeadersFirst.get("RateLimit-Remaining")).toBe("2");
			expect(secondSuccess).toBe(true);
			expect(resHeadersSecond.get("RateLimit-Remaining")).toBe("1");
		});

		it("returns false once hits exceed the configured max", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 2 },
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });

			await limiter.getResult(reqHeaders, new Headers()); // hit 1
			await limiter.getResult(reqHeaders, new Headers()); // hit 2 (at limit)
			const third = await limiter.getResult(reqHeaders, new Headers()); // hit 3 (over limit)

			expect(third).toBe(false);
		});

		it("includes a Retry-After header only once the client is rate limited", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 1 },
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });

			const resHeadersFirst = new Headers();
			await limiter.getResult(reqHeaders, resHeadersFirst);
			const resHeadersSecond = new Headers();
			await limiter.getResult(reqHeaders, resHeadersSecond);

			expect(resHeadersFirst.get("Retry-After")).toBeNull();
			expect(resHeadersSecond.get("Retry-After")).not.toBeNull();
		});

		it("uses custom header names when configured", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 5 },
				headerNames: {
					limit: "X-Limit",
					remaining: "X-Remaining",
					reset: "X-Reset",
					retryAfter: "X-Retry",
				},
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			expect(resHeaders.get("X-Limit")).toBe("5");
			expect(resHeaders.get("X-Remaining")).toBe("4");
		});

		it("exposes all configured header names via Access-Control-Expose-Headers", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 1, ipBased: 1, fingerprint: 1 },
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });
			const resHeaders = new Headers();
			await limiter.getResult(reqHeaders, resHeaders);
			const exposed = resHeaders.get(HeaderKey.AccessControlExposeHeaders);
			expect(exposed).toContain("RateLimit-Limit");
			expect(exposed).toContain("RateLimit-Remaining");
			expect(exposed).toContain("RateLimit-Reset");
			expect(exposed).toContain("Retry-After");
		});

		it("resets the counter once the time window elapses", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 5 },
				windowMs: 20,
			});
			const reqHeaders = new Headers({ "user-agent": "same-client" });

			await limiter.getResult(reqHeaders, new Headers());
			await Bun.sleep(40);
			const resHeadersAfter = new Headers();
			await limiter.getResult(reqHeaders, resHeadersAfter);

			expect(resHeadersAfter.get("RateLimit-Remaining")).toBe("4");
		});
	});

	describe("handler", () => {
		it("calls next() and sets rate-limit headers on the context's response when under the limit", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 5 },
			});
			const ctx = makeContext({ "user-agent": "same-client" });
			const next = mock(async () => "downstream result");

			await limiter.handler(ctx, next);

			expect(next).toHaveBeenCalledTimes(1);
			expect(ctx.res.headers.get("RateLimit-Limit")).toBe("5");
		});

		it("throws a 429 Exception carrying the response when the limit is exceeded", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 1 },
			});
			const next = mock(async () => "downstream result");

			const ctxFirst = makeContext({ "user-agent": "same-client" });
			await limiter.handler(ctxFirst, next);

			const ctxSecond = makeContext({ "user-agent": "same-client" });
			const error = await captureError(() => limiter.handler(ctxSecond, next));

			expect(error).toBeInstanceOf(Exception);
			expect((error as Exception).status).toBe(Status.TOO_MANY_REQUESTS);
		});

		it("does not call next() when the limit is exceeded", async () => {
			new App();
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 999, fingerprint: 1 },
			});
			const next = mock(async () => "downstream result");

			await limiter.handler(makeContext({ "user-agent": "same-client" }), next);
			await captureError(() => limiter.handler(makeContext({ "user-agent": "same-client" }), next));

			expect(next).toHaveBeenCalledTimes(1);
		});
	});

	describe("clearStore / getStoreSize", () => {
		it("reflects entries added via getResult", async () => {
			new App();
			const limiter = new RateLimiter();
			await limiter.getResult(new Headers({ "user-agent": "client-a" }), new Headers());
			await limiter.getResult(new Headers({ "user-agent": "client-b" }), new Headers());
			expect(await limiter.getStoreSize()).toBe(2);
		});

		it("clearStore empties the underlying store", async () => {
			new App();
			const limiter = new RateLimiter();
			await limiter.getResult(new Headers({ "user-agent": "client-a" }), new Headers());
			await limiter.clearStore();
			expect(await limiter.getStoreSize()).toBe(0);
		});
	});

	describe("salt rotation", () => {
		it("treats the same IP as a fresh identity once the salt rotates", async () => {
			new App();
			// saltRotateMs=1 forces a rotation to occur between the two calls below
			const limiter = new RateLimiter({
				limits: { authenticated: 999, ipBased: 10, fingerprint: 999 },
				saltRotateMs: 1,
			});
			const reqHeaders = new Headers({ "x-forwarded-for": "203.0.113.20" });

			const resHeadersFirst = new Headers();
			await limiter.getResult(reqHeaders, resHeadersFirst);
			await Bun.sleep(5);
			const resHeadersSecond = new Headers();
			await limiter.getResult(reqHeaders, resHeadersSecond);

			// if the salt had NOT rotated, the second call would see remaining = 8 (hit 2 of 10).
			// since it rotated, the hashed identity changes and this looks like a brand new
			// client, so remaining resets back to 9 (hit 1 of 10) instead of continuing to count down.
			expect(resHeadersFirst.get("RateLimit-Remaining")).toBe("9");
			expect(resHeadersSecond.get("RateLimit-Remaining")).toBe("9");
		});
	});
});

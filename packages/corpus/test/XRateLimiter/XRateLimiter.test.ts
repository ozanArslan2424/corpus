import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC, TX } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

const s = createTestServer();

describe("X.RateLimiter", () => {
	const makeIpReq = (path: string, ip = "1.2.3.4") =>
		req(path, { headers: { "x-forwarded-for": ip } });

	const makeAuthReq = (path: string, token: string) =>
		req(path, { headers: { authorization: `Bearer ${token}` } });

	// ─── Response Headers ─────────────────────────────────────────

	describe("response headers", () => {
		it("sets ratelimit-limit header on response", async () => {
			new TC.Route("/rl-limit-header", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 60, f: 20 } });

			const res = await s.handle(makeIpReq("/rl-limit-header"));
			expect(res.headers.get("RateLimit-Limit")).not.toBeNull();
		});

		it("sets ratelimit-remaining header on response", async () => {
			new TC.Route("/rl-remaining-header", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 60, f: 20 } });

			const res = await s.handle(makeIpReq("/rl-remaining-header"));
			expect(res.headers.get("RateLimit-Remaining")).not.toBeNull();
		});

		it("sets ratelimit-reset header on response", async () => {
			new TC.Route("/rl-reset-header", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 60, f: 20 } });

			const res = await s.handle(makeIpReq("/rl-reset-header"));
			expect(res.headers.get("RateLimit-Reset")).not.toBeNull();
		});
	});

	// ─── Remaining Count ──────────────────────────────────────────

	describe("remaining", () => {
		it("decrements with each request", async () => {
			new TC.Route("/rl-decrement", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 10, f: 20 } });

			const res1 = await s.handle(makeIpReq("/rl-decrement"));
			const res2 = await s.handle(makeIpReq("/rl-decrement"));

			const remaining1 = Number(res1.headers.get("RateLimit-Remaining"));
			const remaining2 = Number(res2.headers.get("RateLimit-Remaining"));
			expect(remaining2).toBe(remaining1 - 1);
		});

		it("is zero when limit is reached", async () => {
			new TC.Route("/rl-zero-remaining", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 2, f: 20 } });

			await s.handle(makeIpReq("/rl-zero-remaining"));
			await s.handle(makeIpReq("/rl-zero-remaining"));
			const res = await s.handle(makeIpReq("/rl-zero-remaining"));

			expect(res.headers.get("RateLimit-Remaining")).toBe("0");
		});

		it("never goes below zero", async () => {
			new TC.Route("/rl-no-negative", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			for (let i = 0; i < 5; i++) {
				await s.handle(makeIpReq("/rl-no-negative"));
			}

			const res = await s.handle(makeIpReq("/rl-no-negative"));
			expect(Number(res.headers.get("RateLimit-Remaining"))).toBeGreaterThanOrEqual(0);
		});
	});

	// ─── Rate Limiting (429) ──────────────────────────────────────

	describe("rate limiting", () => {
		it("allows request within limit", async () => {
			new TC.Route("/rl-allow", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 5, f: 20 } });

			const res = await s.handle(makeIpReq("/rl-allow"));
			expect(res.status).toBe(200);
		});

		it("blocks request when limit exceeded", async () => {
			new TC.Route("/rl-block", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 2, f: 20 } });

			await s.handle(makeIpReq("/rl-block"));
			await s.handle(makeIpReq("/rl-block"));
			const res = await s.handle(makeIpReq("/rl-block"));

			expect(res.status).toBe(429);
		});

		it("sets retry-after header when blocked", async () => {
			new TC.Route("/rl-retry-after", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			await s.handle(makeIpReq("/rl-retry-after"));
			const res = await s.handle(makeIpReq("/rl-retry-after"));

			expect(res.status).toBe(429);
			expect(res.headers.get("Retry-After")).not.toBeNull();
		});

		it("does not set retry-after when request is allowed", async () => {
			new TC.Route("/rl-no-retry-after", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 10, f: 20 } });

			const res = await s.handle(makeIpReq("/rl-no-retry-after"));
			expect(res.headers.get("Retry-After")).toBeNull();
		});
	});

	// ─── Identity - IP ────────────────────────────────────────────

	describe("identity - ip", () => {
		it("tracks different ips independently", async () => {
			new TC.Route("/rl-ip-separate", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			await s.handle(makeIpReq("/rl-ip-separate", "1.2.3.4"));
			const res = await s.handle(makeIpReq("/rl-ip-separate", "9.8.7.6"));

			expect(res.status).toBe(200);
		});

		it("uses cf-connecting-ip header when present", async () => {
			new TC.Route("/rl-cf-ip", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			await s.handle(req("/rl-cf-ip", { headers: { "cf-connecting-ip": "5.5.5.5" } }));
			const res = await s.handle(req("/rl-cf-ip", { headers: { "cf-connecting-ip": "5.5.5.5" } }));

			expect(res.status).toBe(429);
		});

		it("uses x-real-ip header when present", async () => {
			new TC.Route("/rl-real-ip", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			await s.handle(req("/rl-real-ip", { headers: { "x-real-ip": "6.6.6.6" } }));
			const res = await s.handle(req("/rl-real-ip", { headers: { "x-real-ip": "6.6.6.6" } }));

			expect(res.status).toBe(429);
		});

		it("ignores invalid ip and falls back to fingerprint", async () => {
			new TC.Route("/rl-invalid-ip", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 60, f: 1 } });

			await s.handle(
				req("/rl-invalid-ip", {
					headers: { "x-forwarded-for": "not-an-ip", "user-agent": "test-ua" },
				}),
			);
			const res = await s.handle(
				req("/rl-invalid-ip", {
					headers: { "x-forwarded-for": "not-an-ip", "user-agent": "test-ua" },
				}),
			);

			expect(res.status).toBe(429);
		});
	});

	// ─── Identity - Auth Token ────────────────────────────────────

	describe("identity - auth", () => {
		it("tracks by token independently from ip", async () => {
			new TC.Route("/rl-auth-separate", () => "ok");
			new TX.RateLimiter({ limits: { u: 5, i: 1, f: 20 } });

			// Exhaust IP limit
			await s.handle(makeIpReq("/rl-auth-separate", "7.7.7.7"));
			const ipBlocked = await s.handle(makeIpReq("/rl-auth-separate", "7.7.7.7"));
			expect(ipBlocked.status).toBe(429);

			// Auth token should have its own (higher) limit and not be blocked
			const token = "a".repeat(20);
			const res = await s.handle(makeAuthReq("/rl-auth-separate", token));
			expect(res.status).toBe(200);
		});

		it("applies higher limit for authenticated users", async () => {
			new TC.Route("/rl-auth-limit", () => "ok");
			new TX.RateLimiter({ limits: { u: 5, i: 1, f: 20 } });

			const token = "b".repeat(20);
			// IP limit is 1, auth limit is 5 — do 3 requests, expect all to pass
			for (let i = 0; i < 3; i++) {
				const res = await s.handle(makeAuthReq("/rl-auth-limit", token));
				expect(res.status).toBe(200);
			}
		});

		it("ignores token shorter than 20 chars", async () => {
			new TC.Route("/rl-short-token", () => "ok");
			new TX.RateLimiter({ limits: { u: 120, i: 1, f: 20 } });

			// Short token — should fall back to IP or fingerprint, not u: limit
			await s.handle(makeAuthReq("/rl-short-token", "tooshort"));
			const res = await s.handle(makeAuthReq("/rl-short-token", "tooshort"));

			// With ip limit of 1, it should be blocked (not using u: limit of 120)
			// This confirms the short token was NOT used as an auth identity
			const limit = Number(res.headers.get("RateLimit-Limit"));
			expect(limit).not.toBe(120);
		});
	});

	// ─── Custom Header Names ──────────────────────────────────────

	it("config - uses custom header names when provided", async () => {
		new TC.Route("/rl-custom-headers", () => "ok");
		new TX.RateLimiter({
			limits: { u: 120, i: 60, f: 20 },
			headerNames: {
				limit: "X-My-Limit",
				remaining: "X-My-Remaining",
				reset: "X-My-Reset",
				retryAfter: "X-My-Retry-After",
			},
		});

		const res = await s.handle(makeIpReq("/rl-custom-headers"));
		expect(res.headers.get("X-My-Limit")).not.toBeNull();
		expect(res.headers.get("X-My-Remaining")).not.toBeNull();
		expect(res.headers.get("X-My-Reset")).not.toBeNull();
		expect(res.headers.get("RateLimit-Limit")).toBeNull();
	});

	// ─── Combined ─────────────────────────────────────────────────

	it("combined - all headers present with correct values on first request", async () => {
		new TC.Route("/rl-combined", () => "ok");
		new TX.RateLimiter({
			limits: { u: 120, i: 10, f: 20 },
			windowMs: 60_000,
		});

		const res = await s.handle(makeIpReq("/rl-combined"));

		expect(res.status).toBe(200);
		expect(res.headers.get("RateLimit-Limit")).toBe("10");
		expect(res.headers.get("RateLimit-Remaining")).toBe("9");
		expect(Number(res.headers.get("RateLimit-Reset"))).toBeGreaterThan(
			Math.floor(Date.now() / 1000),
		);
		expect(res.headers.get("Retry-After")).toBeNull();
	});
});

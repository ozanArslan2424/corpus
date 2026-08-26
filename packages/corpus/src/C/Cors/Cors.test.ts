import { describe, expect, it } from "bun:test";

import { createTestServer } from "#testutils";
import { Cors } from "@/C/Cors/Cors";
import { Route } from "@/C/Route/Route";

const s = createTestServer();

describe("Cors", () => {
	const allowedOrigin = "https://example.com";
	const disallowedOrigin = "https://evil.com";
	const secondOrigin = "https://other.com";

	it("all options set together", async () => {
		new Cors({
			allowedOrigins: [allowedOrigin],
			allowedMethods: ["GET", "POST"],
			allowedHeaders: ["Content-Type"],
			credentials: true,
		});
		const r = new Route("/cors-combined", () => "ok");
		const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
		expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	describe("allowedOrigins", () => {
		it("sets header when origin is allowed", async () => {
			new Cors({ allowedOrigins: [allowedOrigin] });
			const r = new Route("/cors-origin-allowed", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
		});

		it("does not set header when origin is disallowed", async () => {
			new Cors({ allowedOrigins: [allowedOrigin] });
			const r = new Route("/cors-origin-disallowed", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: disallowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("does not set header when no origin in request", async () => {
			new Cors({ allowedOrigins: [allowedOrigin] });
			const r = new Route("/cors-origin-missing", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("does not set header when allowed origins is empty", async () => {
			new Cors({ allowedOrigins: [] });
			const r = new Route("/cors-origin-empty", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("reflects correct origin when multiple are allowed", async () => {
			new Cors({ allowedOrigins: [allowedOrigin, secondOrigin] });
			const r = new Route("/cors-origin-multi", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: secondOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(secondOrigin);
		});
	});

	describe("allowedMethods", () => {
		it("sets header when methods are provided", async () => {
			new Cors({ allowedMethods: ["GET", "POST"] });
			const r = new Route("/cors-methods", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		});

		it("does not set header when methods are empty", async () => {
			new Cors({ allowedMethods: [] });
			const r = new Route("/cors-methods-empty", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
		});

		it("does not set header when methods are undefined", async () => {
			new Cors({});
			const r = new Route("/cors-methods-undefined", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
		});
	});

	describe("allowedHeaders", () => {
		it("sets header when headers are provided", async () => {
			new Cors({ allowedHeaders: ["Content-Type", "Authorization"] });
			const r = new Route("/cors-headers", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
		});

		it("does not set header when headers are empty", async () => {
			const s = createTestServer();
			new Cors({ allowedHeaders: [] });
			const r = new Route("/cors-headers-empty", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Headers")).toBeNull();
		});
	});

	describe("credentials", () => {
		it("sets true when enabled", async () => {
			new Cors({ credentials: true });
			const r = new Route("/cors-credentials-true", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});

		it("sets false when disabled", async () => {
			new Cors({ credentials: false });
			const r = new Route("/cors-credentials-false", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
		});

		it("sets false when undefined", async () => {
			new Cors({});
			const r = new Route("/cors-credentials-undefined", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
		});
	});
});

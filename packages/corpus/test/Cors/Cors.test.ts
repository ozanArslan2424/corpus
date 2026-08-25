import { describe, expect, it } from "bun:test";

import { TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";

const s = createTestServer();

describe("Cors", () => {
	const allowedOrigin = "https://example.com";
	const disallowedOrigin = "https://evil.com";
	const secondOrigin = "https://other.com";

	it("all options set together", async () => {
		new TC.Cors({
			allowedOrigins: [allowedOrigin],
			allowedMethods: ["GET", "POST"],
			allowedHeaders: ["Content-Type"],
			credentials: true,
		});
		const r = new TC.Route("/cors-combined", () => "ok");
		const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
		expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	describe("allowedOrigins", () => {
		it("sets header when origin is allowed", async () => {
			new TC.Cors({ allowedOrigins: [allowedOrigin] });
			const r = new TC.Route("/cors-origin-allowed", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
		});

		it("does not set header when origin is disallowed", async () => {
			new TC.Cors({ allowedOrigins: [allowedOrigin] });
			const r = new TC.Route("/cors-origin-disallowed", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: disallowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("does not set header when no origin in request", async () => {
			new TC.Cors({ allowedOrigins: [allowedOrigin] });
			const r = new TC.Route("/cors-origin-missing", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("does not set header when allowed origins is empty", async () => {
			new TC.Cors({ allowedOrigins: [] });
			const r = new TC.Route("/cors-origin-empty", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: allowedOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("reflects correct origin when multiple are allowed", async () => {
			new TC.Cors({ allowedOrigins: [allowedOrigin, secondOrigin] });
			const r = new TC.Route("/cors-origin-multi", () => "ok");
			const res = await s.handle(r.request({ headers: { origin: secondOrigin } }));
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(secondOrigin);
		});
	});

	describe("allowedMethods", () => {
		it("sets header when methods are provided", async () => {
			new TC.Cors({ allowedMethods: ["GET", "POST"] });
			const r = new TC.Route("/cors-methods", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		});

		it("does not set header when methods are empty", async () => {
			new TC.Cors({ allowedMethods: [] });
			const r = new TC.Route("/cors-methods-empty", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
		});

		it("does not set header when methods are undefined", async () => {
			new TC.Cors({});
			const r = new TC.Route("/cors-methods-undefined", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
		});
	});

	describe("allowedHeaders", () => {
		it("sets header when headers are provided", async () => {
			new TC.Cors({ allowedHeaders: ["Content-Type", "Authorization"] });
			const r = new TC.Route("/cors-headers", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
		});

		it("does not set header when headers are empty", async () => {
			const s = createTestServer();
			new TC.Cors({ allowedHeaders: [] });
			const r = new TC.Route("/cors-headers-empty", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Headers")).toBeNull();
		});
	});

	describe("credentials", () => {
		it("sets true when enabled", async () => {
			new TC.Cors({ credentials: true });
			const r = new TC.Route("/cors-credentials-true", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});

		it("sets false when disabled", async () => {
			new TC.Cors({ credentials: false });
			const r = new TC.Route("/cors-credentials-false", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
		});

		it("sets false when undefined", async () => {
			new TC.Cors({});
			const r = new TC.Route("/cors-credentials-undefined", () => "ok");
			const res = await s.handle(r.request({}));
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
		});
	});
});

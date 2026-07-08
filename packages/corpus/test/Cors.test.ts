import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

beforeEach(() => $registryTesting.reset());

describe("C.Cors", () => {
	const allowedOrigin = "https://example.com";
	const disallowedOrigin = "https://evil.com";

	// ─── allowedOrigins ───────────────────────────────────────────

	it("ORIGIN - SETS HEADER WHEN ORIGIN IS ALLOWED", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: [allowedOrigin] });
		new TC.Route("/cors-origin-allowed", () => "ok");

		const res = await s.handle(req("/cors-origin-allowed", { headers: { origin: allowedOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
	});

	it("ORIGIN - DOES NOT SET HEADER WHEN ORIGIN IS DISALLOWED", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: [allowedOrigin] });
		new TC.Route("/cors-origin-disallowed", () => "ok");

		const res = await s.handle(
			req("/cors-origin-disallowed", { headers: { origin: disallowedOrigin } }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("ORIGIN - DOES NOT SET HEADER WHEN NO ORIGIN IN REQUEST", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: [allowedOrigin] });
		new TC.Route("/cors-origin-missing", () => "ok");

		const res = await s.handle(req("/cors-origin-missing"));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("ORIGIN - DOES NOT SET HEADER WHEN ALLOWED ORIGINS IS EMPTY", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedOrigins: [] });
		new TC.Route("/cors-origin-empty", () => "ok");

		const res = await s.handle(req("/cors-origin-empty", { headers: { origin: allowedOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("ORIGIN - REFLECTS CORRECT ORIGIN WHEN MULTIPLE ARE ALLOWED", async () => {
		const s = createTestServer();
		const secondOrigin = "https://other.com";
		new TC.Cors({ allowedOrigins: [allowedOrigin, secondOrigin] });
		new TC.Route("/cors-origin-multi", () => "ok");

		const res = await s.handle(req("/cors-origin-multi", { headers: { origin: secondOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(secondOrigin);
	});

	// ─── allowedMethods ───────────────────────────────────────────

	it("METHODS - SETS HEADER WHEN METHODS ARE PROVIDED", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedMethods: ["GET", "POST"] });
		new TC.Route("/cors-methods", () => "ok");

		const res = await s.handle(req("/cors-methods"));
		expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
	});

	it("METHODS - DOES NOT SET HEADER WHEN METHODS ARE EMPTY", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedMethods: [] });
		new TC.Route("/cors-methods-empty", () => "ok");

		const res = await s.handle(req("/cors-methods-empty"));
		expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
	});

	it("METHODS - DOES NOT SET HEADER WHEN METHODS ARE UNDEFINED", async () => {
		const s = createTestServer();
		new TC.Cors({});
		new TC.Route("/cors-methods-undefined", () => "ok");

		const res = await s.handle(req("/cors-methods-undefined"));
		expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
	});

	// ─── allowedHeaders ───────────────────────────────────────────

	it("HEADERS - SETS HEADER WHEN HEADERS ARE PROVIDED", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedHeaders: ["Content-Type", "Authorization"] });
		new TC.Route("/cors-headers", () => "ok");

		const res = await s.handle(req("/cors-headers"));
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
	});

	it("HEADERS - DOES NOT SET HEADER WHEN HEADERS ARE EMPTY", async () => {
		const s = createTestServer();
		new TC.Cors({ allowedHeaders: [] });
		new TC.Route("/cors-headers-empty", () => "ok");

		const res = await s.handle(req("/cors-headers-empty"));
		expect(res.headers.get("Access-Control-Allow-Headers")).toBeNull();
	});

	// ─── credentials ──────────────────────────────────────────────

	it("CREDENTIALS - SETS TRUE WHEN ENABLED", async () => {
		const s = createTestServer();
		new TC.Cors({ credentials: true });
		new TC.Route("/cors-credentials-true", () => "ok");

		const res = await s.handle(req("/cors-credentials-true"));
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("CREDENTIALS - SETS FALSE WHEN DISABLED", async () => {
		const s = createTestServer();
		new TC.Cors({ credentials: false });
		new TC.Route("/cors-credentials-false", () => "ok");

		const res = await s.handle(req("/cors-credentials-false"));
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
	});

	it("CREDENTIALS - SETS FALSE WHEN UNDEFINED", async () => {
		const s = createTestServer();
		new TC.Cors({});
		new TC.Route("/cors-credentials-undefined", () => "ok");

		const res = await s.handle(req("/cors-credentials-undefined"));
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
	});

	// ─── combined ─────────────────────────────────────────────────

	it("COMBINED - ALL OPTIONS SET TOGETHER", async () => {
		const s = createTestServer();
		new TC.Cors({
			allowedOrigins: [allowedOrigin],
			allowedMethods: ["GET", "POST"],
			allowedHeaders: ["Content-Type"],
			credentials: true,
		});
		new TC.Route("/cors-combined", () => "ok");

		const res = await s.handle(req("/cors-combined", { headers: { origin: allowedOrigin } }));
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
		expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});
});

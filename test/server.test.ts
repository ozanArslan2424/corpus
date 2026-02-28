import C from "@/index";
import { describe, expect, it } from "bun:test";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

describe("C.Server", () => {
	// ─── handle() - routing ───────────────────────────────────────

	it("HANDLE - RETURNS 200 FOR REGISTERED ROUTE", async () => {
		const s = createTestServer();
		new C.Route("/srv-200", () => "ok");
		const res = await s.handle(req("/srv-200"));
		expect(res.status).toBe(200);
	});

	it("HANDLE - RETURNS 404 FOR UNREGISTERED ROUTE", async () => {
		const s = createTestServer();
		const res = await s.handle(req("/srv-does-not-exist"));
		expect(res.status).toBe(404);
	});

	it("HANDLE - RETURNS 405 FOR WRONG METHOD", async () => {
		const s = createTestServer();
		new C.Route({ method: C.Method.POST, path: "/srv-405" }, () => "ok");
		const res = await s.handle(req("/srv-405", { method: "GET" }));
		expect(res.status).toBe(405);
	});

	it("HANDLE - RETURNS HANDLER RESULT AS BODY", async () => {
		const s = createTestServer();
		new C.Route("/srv-body", () => ({ hello: "world" }));
		const res = await s.handle(req("/srv-body"));
		const data = await C.Parser.getBody<{ hello: string }>(res);
		expect(data.hello).toBe("world");
	});

	// ─── preflight ────────────────────────────────────────────────

	it("PREFLIGHT - RETURNS 200 WITH DEPARTED BODY", async () => {
		const s = createTestServer();
		const res = await s.handle(
			req("/srv-preflight", {
				method: "OPTIONS",
				headers: { "Access-Control-Request-Method": "POST" },
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toBe("Departed");
	});

	// ─── setOnError ───────────────────────────────────────────────

	it("SET ON ERROR - CUSTOM HANDLER IS CALLED ON ERROR", async () => {
		const s = createTestServer();
		s.setOnError(async () => {
			return new C.Response(
				{ error: true, message: "custom error" },
				{ status: 500 },
			);
		});
		new C.Route("/srv-error", () => {
			throw new Error("boom");
		});
		const res = await s.handle(req("/srv-error"));
		expect(res.status).toBe(500);
		const data = await C.Parser.getBody<{ message: string }>(res);
		expect(data.message).toBe("custom error");
	});

	it("SET ON ERROR - DEFAULT HANDLER RETURNS 500", async () => {
		const s = createTestServer();
		new C.Route("/srv-error-default", () => {
			throw new Error("unexpected");
		});
		const res = await s.handle(req("/srv-error-default"));
		expect(res.status).toBe(500);
	});

	it("SET ON ERROR - HTTP ERROR IS HANDLED BY DEFAULT HANDLER", async () => {
		const s = createTestServer();
		new C.Route("/srv-httperror", () => {
			throw C.Error.badRequest("bad input");
		});
		const res = await s.handle(req("/srv-httperror"));
		expect(res.status).toBe(400);
		const data = await C.Parser.getBody<{ message: string }>(res);
		expect(data.message).toBe("bad input");
	});

	// ─── setOnNotFound ────────────────────────────────────────────

	it("SET ON NOT FOUND - CUSTOM HANDLER IS CALLED", async () => {
		const s = createTestServer();
		s.setOnNotFound(async () => {
			return new C.Response(
				{ error: true, message: "custom not found" },
				{ status: 404 },
			);
		});
		const res = await s.handle(req("/srv-custom-404"));
		expect(res.status).toBe(404);
		const data = await C.Parser.getBody<{ message: string }>(res);
		expect(data.message).toBe("custom not found");
	});

	it("SET ON NOT FOUND - DEFAULT HANDLER INCLUDES METHOD AND URL", async () => {
		const s = createTestServer();
		const res = await s.handle(req("/srv-default-404"));
		expect(res.status).toBe(404);
		const data = await C.Parser.getBody<{ message: string }>(res);
		expect(data.message).toContain("GET");
		expect(data.message).toContain("/srv-default-404");
	});

	// ─── setOnAfterResponse ───────────────────────────────────────

	it("SET ON AFTER RESPONSE - CAN MODIFY RESPONSE", async () => {
		const s = createTestServer();
		s.setOnAfterResponse(async (res) => {
			res.headers.set("x-after", "applied");
			return res;
		});
		new C.Route("/srv-after", () => "ok");
		const res = await s.handle(req("/srv-after"));
		expect(res.headers.get("x-after")).toBe("applied");
	});

	it("SET ON AFTER RESPONSE - IS CALLED EVEN ON 404", async () => {
		const s = createTestServer();
		s.setOnAfterResponse(async (res) => {
			res.headers.set("x-after-404", "yes");
			return res;
		});
		const res = await s.handle(req("/srv-after-404-missing"));
		expect(res.headers.get("x-after-404")).toBe("yes");
	});

	// ─── setGlobalPrefix ──────────────────────────────────────────

	it("SET GLOBAL PREFIX - ROUTE IS ACCESSIBLE UNDER PREFIX", async () => {
		const s = createTestServer();
		s.setGlobalPrefix("/api");
		new C.Route("/srv-prefixed", () => "prefixed");
		const res = await s.handle(req("/srv-prefixed"));
		expect(res.status).toBe(200);
		// reset prefix so it doesn't bleed into other tests
		s.setGlobalPrefix("");
	});

	it("SET GLOBAL PREFIX - ROUTE IS NOT ACCESSIBLE WITHOUT PREFIX", async () => {
		const s = createTestServer();
		s.setGlobalPrefix("/api");
		new C.Route("/srv-no-prefix", () => "ok");
		const res = await s.handle(
			new Request("http://localhost:4444/srv-no-prefix"),
		);
		expect(res.status).toBe(404);
		s.setGlobalPrefix("");
	});

	// ─── CORS integration ─────────────────────────────────────────

	it("CORS - SETS ORIGIN HEADER ON ALLOWED ORIGIN", async () => {
		const s = createTestServer();
		s.setCors({ allowedOrigins: ["https://example.com"] });
		new C.Route("/srv-cors", () => "ok");
		const res = await s.handle(
			req("/srv-cors", { headers: { origin: "https://example.com" } }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://example.com",
		);
	});

	it("CORS - DOES NOT SET ORIGIN HEADER ON DISALLOWED ORIGIN", async () => {
		const s = createTestServer();
		s.setCors({ allowedOrigins: ["https://example.com"] });
		new C.Route("/srv-cors-blocked", () => "ok");
		const res = await s.handle(
			req("/srv-cors-blocked", { headers: { origin: "https://evil.com" } }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("CORS - IS NOT APPLIED WHEN NOT SET", async () => {
		const s = createTestServer();
		new C.Route("/srv-no-cors", () => "ok");
		const res = await s.handle(
			req("/srv-no-cors", { headers: { origin: "https://example.com" } }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

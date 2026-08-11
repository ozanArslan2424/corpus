import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { parseBody } from "../utils/parse";
import { req } from "../utils/req";

beforeEach(() => $registryTesting.reset());

const s = createTestServer();

describe("C.Exception", () => {
	// ─── constructor ──────────────────────────────────────────────

	it("CONSTRUCTOR - SETS MESSAGE, STATUS AND DATA", () => {
		const err = new TC.Exception("something went wrong", 400, { field: "name" });
		expect(err.message).toBe("something went wrong");
		expect(err.status).toBe(400);
		expect(err.data).toEqual({ field: "name" });
	});

	it("CONSTRUCTOR - DATA IS OPTIONAL", () => {
		const err = new TC.Exception("oops", 500);
		expect(err.data).toBeUndefined();
	});

	it("CONSTRUCTOR - IS INSTANCE OF ERROR", () => {
		const err = new TC.Exception("oops", 500);
		expect(err).toBeInstanceOf(Error);
	});

	// ─── isStatusOf ───────────────────────────────────────────────

	it("IS STATUS OF - RETURNS TRUE WHEN STATUS MATCHES", () => {
		const err = new TC.Exception("not found", 404);
		expect(err.isStatusOf(404)).toBe(true);
	});

	it("IS STATUS OF - RETURNS FALSE WHEN STATUS DOES NOT MATCH", () => {
		const err = new TC.Exception("not found", 404);
		expect(err.isStatusOf(500)).toBe(false);
	});

	// ─── res ───────────────────────────────────────────────

	it("TO RESPONSE - RETURNS CORRECT STATUS", () => {
		const err = new TC.Exception("bad request", 400);
		const res = err.response;
		expect(res.status).toBe(400);
	});

	it("TO RESPONSE - WITHOUT DATA USES ERROR TRUE", async () => {
		const err = new TC.Exception("bad request", 400);
		const res = err.response;
		const data = await parseBody<{ error: boolean; message: string }>(res);
		expect(data.error).toBe(true);
		expect(data.message).toBe("bad request");
	});

	it("TO RESPONSE - WITH DATA USES ERROR DATA", async () => {
		const err = new TC.Exception("invalid", 422, { field: "email" });
		const res = err.response;
		const data = await parseBody<{ error: unknown; message: string }>(res);
		expect(data.error).toEqual({ field: "email" });
		expect(data.message).toBe("invalid");
	});

	// ─── integration ──────────────────────────────────────────────

	it("INTEGRATION - THROWN IN ROUTE RETURNS CORRECT STATUS", async () => {
		new TC.Route("/error-400", () => {
			throw new TC.Exception("not here", TC.Status.BAD_REQUEST);
		});

		const res = await s.handle(req("/error-400"));
		expect(res.status).toBe(400);
	});

	it("INTEGRATION - THROWN IN ROUTE RETURNS DEFAULT BODY", async () => {
		new TC.Route("/error-422", () => {
			throw new TC.Exception("invalid fields", TC.Status.UNPROCESSABLE_ENTITY);
		});

		const res = await s.handle(req("/error-422"));
		const data = await parseBody<{ error: boolean; message: string }>(res);
		expect(res.status).toBe(422);
		expect(data.message).toBe("invalid fields");
	});

	it("INTEGRATION - NOT FOUND ROUTE RETURNS 404", async () => {
		const res = await s.handle(req("/does-not-exist"));
		expect(res.status).toBe(404);
	});

	it("INTEGRATION - WRONG METHOD RETURNS 405 | 404", async () => {
		new TC.Route("/error-method", () => "ok");
		const res = await s.handle(req("/error-method", { method: "POST" }));
		expect(res.status === 404 || res.status === 405).toBeTrue();
	});
});

import C from "@/index";
import { describe, expect, it } from "bun:test";
import { createTestServer } from "./utils/createTestServer";
import { req } from "./utils/req";

const s = createTestServer();

describe("C.Error", () => {
	// ─── constructor ──────────────────────────────────────────────

	it("CONSTRUCTOR - SETS MESSAGE, STATUS AND DATA", () => {
		const err = new C.Error("something went wrong", 400, { field: "name" });
		expect(err.message).toBe("something went wrong");
		expect(err.status).toBe(400);
		expect(err.data).toEqual({ field: "name" });
	});

	it("CONSTRUCTOR - DATA IS OPTIONAL", () => {
		const err = new C.Error("oops", 500);
		expect(err.data).toBeUndefined();
	});

	it("CONSTRUCTOR - IS INSTANCE OF ERROR", () => {
		const err = new C.Error("oops", 500);
		expect(err).toBeInstanceOf(Error);
	});

	// ─── isStatusOf ───────────────────────────────────────────────

	it("IS STATUS OF - RETURNS TRUE WHEN STATUS MATCHES", () => {
		const err = new C.Error("not found", 404);
		expect(err.isStatusOf(404)).toBe(true);
	});

	it("IS STATUS OF - RETURNS FALSE WHEN STATUS DOES NOT MATCH", () => {
		const err = new C.Error("not found", 404);
		expect(err.isStatusOf(500)).toBe(false);
	});

	// ─── toResponse ───────────────────────────────────────────────

	it("TO RESPONSE - RETURNS CORRECT STATUS", () => {
		const err = new C.Error("bad request", 400);
		const res = err.toResponse();
		expect(res.status).toBe(400);
	});

	it("TO RESPONSE - WITHOUT DATA USES ERROR TRUE", async () => {
		const err = new C.Error("bad request", 400);
		const res = err.toResponse();
		const data = await C.Parser.getBody<{ error: boolean; message: string }>(
			res,
		);
		expect(data.error).toBe(true);
		expect(data.message).toBe("bad request");
	});

	it("TO RESPONSE - WITH DATA USES ERROR DATA", async () => {
		const err = new C.Error("invalid", 422, { field: "email" });
		const res = err.toResponse();
		const data = await C.Parser.getBody<{ error: unknown; message: string }>(
			res,
		);
		expect(data.error).toEqual({ field: "email" });
		expect(data.message).toBe("invalid");
	});

	// ─── static methods ───────────────────────────────────────────

	it("INTERNAL SERVER ERROR - DEFAULT MESSAGE", () => {
		const err = C.Error.internalServerError();
		expect(err.status).toBe(500);
		expect(err.message).toBe("500");
	});

	it("INTERNAL SERVER ERROR - CUSTOM MESSAGE", () => {
		const err = C.Error.internalServerError("custom");
		expect(err.status).toBe(500);
		expect(err.message).toBe("custom");
	});

	it("BAD REQUEST - DEFAULT MESSAGE", () => {
		const err = C.Error.badRequest();
		expect(err.status).toBe(400);
		expect(err.message).toBe("400");
	});

	it("BAD REQUEST - CUSTOM MESSAGE", () => {
		const err = C.Error.badRequest("invalid input");
		expect(err.status).toBe(400);
		expect(err.message).toBe("invalid input");
	});

	it("NOT FOUND - DEFAULT MESSAGE", () => {
		const err = C.Error.notFound();
		expect(err.status).toBe(404);
		expect(err.message).toBe("404");
	});

	it("NOT FOUND - CUSTOM MESSAGE", () => {
		const err = C.Error.notFound("resource missing");
		expect(err.status).toBe(404);
		expect(err.message).toBe("resource missing");
	});

	it("METHOD NOT ALLOWED - DEFAULT MESSAGE", () => {
		const err = C.Error.methodNotAllowed();
		expect(err.status).toBe(405);
		expect(err.message).toBe("405");
	});

	it("METHOD NOT ALLOWED - CUSTOM MESSAGE", () => {
		const err = C.Error.methodNotAllowed("not allowed");
		expect(err.status).toBe(405);
		expect(err.message).toBe("not allowed");
	});

	it("UNPROCESSABLE ENTITY - DEFAULT MESSAGE", () => {
		const err = C.Error.unprocessableEntity();
		expect(err.status).toBe(422);
		expect(err.message).toBe("422");
	});

	it("UNPROCESSABLE ENTITY - CUSTOM MESSAGE", () => {
		const err = C.Error.unprocessableEntity("validation failed");
		expect(err.status).toBe(422);
		expect(err.message).toBe("validation failed");
	});

	// ─── integration ──────────────────────────────────────────────

	it("INTEGRATION - THROWN IN ROUTE RETURNS CORRECT STATUS", async () => {
		new C.Route("/error-404", () => {
			throw C.Error.notFound("not here");
		});

		const res = await s.handle(req("/error-404"));
		expect(res.status).toBe(404);
	});

	it("INTEGRATION - THROWN IN ROUTE RETURNS CORRECT BODY", async () => {
		new C.Route("/error-422", () => {
			throw C.Error.unprocessableEntity("invalid fields");
		});

		const res = await s.handle(req("/error-422"));
		const data = await C.Parser.getBody<{ error: boolean; message: string }>(
			res,
		);
		expect(res.status).toBe(422);
		expect(data.message).toBe("invalid fields");
	});

	it("INTEGRATION - NOT FOUND ROUTE RETURNS 404", async () => {
		const res = await s.handle(req("/does-not-exist"));
		expect(res.status).toBe(404);
	});

	it("INTEGRATION - WRONG METHOD RETURNS 405", async () => {
		new C.Route("/error-method", () => "ok");

		const res = await s.handle(req("/error-method", { method: "POST" }));
		expect(res.status).toBe(405);
	});
});

import { afterEach, describe, expect, it } from "bun:test";

import { createTestServer, parseBody, req } from "#testutils";
import { Exception } from "@/C/Exception/Exception";
import { Status } from "@/C/Res/Status";
import { Route } from "@/C/Route/Route";
import { $registry } from "@/Registry";

const s = createTestServer();

afterEach(() => $registry.reset());

describe("Exception", () => {
	describe("constructor", () => {
		it("sets message, status and data", () => {
			const err = new Exception("something went wrong", 400, { field: "name" });
			expect(err.message).toBe("something went wrong");
			expect(err.status).toBe(400);
			expect(err.data).toEqual({ field: "name" });
		});

		it("data is optional", () => {
			const err = new Exception("oops", 500);
			expect(err.data).toBeUndefined();
		});

		it("is instance of error", () => {
			const err = new Exception("oops", 500);
			expect(err).toBeInstanceOf(Error);
		});
	});

	describe("isStatusOf", () => {
		it("returns true when status matches", () => {
			const err = new Exception("not found", 404);
			expect(err.isStatusOf(404)).toBe(true);
		});

		it("returns false when status does not match", () => {
			const err = new Exception("not found", 404);
			expect(err.isStatusOf(500)).toBe(false);
		});
	});

	describe("response", () => {
		it("returns correct status", () => {
			const err = new Exception("bad request", 400);
			const res = err.response;
			expect(res.status).toBe(400);
		});

		it("without data uses error true", async () => {
			const err = new Exception("bad request", 400);
			const res = err.response;
			const data = await parseBody<{ error: boolean; message: string }>(res);
			expect(data.error).toBe(true);
			expect(data.message).toBe("bad request");
		});

		it("with data uses error data", async () => {
			const err = new Exception("invalid", 422, { field: "email" });
			const res = err.response;
			const data = await parseBody<{ error: unknown; message: string }>(res);
			expect(data.error).toEqual({ field: "email" });
			expect(data.message).toBe("invalid");
		});
	});

	describe("integration", () => {
		it("thrown in route returns correct status", async () => {
			new Route("/error-400", () => {
				throw new Exception("not here", Status.BAD_REQUEST);
			});

			const res = await s.handle(req("/error-400"));
			expect(res.status).toBe(400);
		});

		it("thrown in route returns default body", async () => {
			new Route("/error-422", () => {
				throw new Exception("invalid fields", Status.UNPROCESSABLE_ENTITY);
			});

			const res = await s.handle(req("/error-422"));
			const data = await parseBody<{ error: boolean; message: string }>(res);
			expect(res.status).toBe(422);
			expect(data.message).toBe("invalid fields");
		});

		it("not found route returns 404", async () => {
			const res = await s.handle(req("/does-not-exist"));
			expect(res.status).toBe(404);
		});

		// This might change based on the router implementation
		it("wrong method returns 405 | 404 (based on router)", async () => {
			new Route("/error-method", () => "ok");
			const res = await s.handle(req("/error-method", { method: "POST" }));
			expect(res.status === 404 || res.status === 405).toBeTrue();
		});
	});
});

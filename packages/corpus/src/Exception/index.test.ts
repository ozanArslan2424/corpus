import { describe, expect, it } from "bun:test";

import { Exception } from "@/Exception";
import { Res, Status } from "@/Res";

describe("Exception", () => {
	describe("direct construction", () => {
		it("sets message, status, and data", () => {
			const err = new Exception("Not found", Status.NOT_FOUND, { id: 1 });
			expect(err.message).toBe("Not found");
			expect(err.status).toBe(Status.NOT_FOUND);
			expect(err.data).toEqual({ id: 1 });
		});

		it("leaves data undefined when omitted", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.data).toBeUndefined();
		});

		it("is an instance of Error", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err).toBeInstanceOf(Error);
		});

		it("throws when constructed with no arguments", () => {
			expect(() => new Exception()).toThrow();
		});

		it("throws when constructed with only a message", () => {
			// @ts-expect-error - exercising the runtime guard for a missing status
			expect(() => new Exception("Not found")).toThrow();
		});
	});

	describe("subclassing", () => {
		class NotFoundException extends Exception {
			constructor(message: string) {
				super();
				this.message = message;
				this.status = Status.NOT_FOUND;
			}
		}

		it("bypasses the argument guard when extended", () => {
			const err = new NotFoundException("Not found");
			expect(err.message).toBe("Not found");
			expect(err.status).toBe(Status.NOT_FOUND);
		});

		it("does not auto-populate fields left unset by the subclass", () => {
			class BareException extends Exception {
				constructor() {
					super();
				}
			}
			const err = new BareException();
			expect(err.status).toBeUndefined();
			expect(err.data).toBeUndefined();
		});
	});

	describe("isStatusOf", () => {
		it("returns true when given the numeric status that matches", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.isStatusOf(Status.NOT_FOUND)).toBe(true);
		});

		it("returns false when given a numeric status that does not match", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.isStatusOf(Status.BAD_REQUEST)).toBe(false);
		});

		it("returns true when given the matching Status key name as a string", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.isStatusOf("NOT_FOUND")).toBe(true);
		});

		it("returns false when given a non-matching Status key name as a string", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.isStatusOf("BAD_REQUEST")).toBe(false);
		});
	});

	describe("toRes", () => {
		it("returns a Res instance", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.toRes()).toBeInstanceOf(Res);
		});

		it("sets the Res status to the exception's status", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.toRes().status).toBe(Status.NOT_FOUND);
		});

		it("builds a default body with the error data and message when data is not a Res", () => {
			const err = new Exception("Not found", Status.NOT_FOUND, { id: 1 });
			expect(err.toRes().body).toEqual({ error: { id: 1 }, message: "Not found" });
		});

		it("defaults error to true in the body when data is undefined", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.toRes().body).toEqual({ message: "Not found" });
		});

		it("reuses the same Res instance when data is already a Res", () => {
			const providedRes = new Res("original body");
			const err = new Exception("Not found", Status.NOT_FOUND, providedRes);
			expect(err.toRes()).toBe(providedRes);
		});

		it("overwrites the reused Res's status with the exception's status", () => {
			const providedRes = new Res("original body", { status: Status.OK });
			const err = new Exception("Custom error", Status.INTERNAL_SERVER_ERROR, providedRes);
			expect(err.toRes().status).toBe(Status.INTERNAL_SERVER_ERROR);
		});

		it("produces a fresh Res on each call when data is not already a Res", () => {
			const err = new Exception("Not found", Status.NOT_FOUND);
			expect(err.toRes()).not.toBe(err.toRes());
		});
	});
});

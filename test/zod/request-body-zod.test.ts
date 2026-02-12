import { describe, expect, it } from "bun:test";
import { reqMaker } from "../utils/reqMaker";
import { pathMaker } from "../utils/pathMaker";
import z from "zod";
import { CommonHeaders } from "@/internal/enums/CommonHeaders";
import { Status } from "@/internal/enums/Status";
import { Route } from "@/internal/modules/Route/Route";
import { Server } from "@/exports";

const s = new Server({});
const prefix = "/request-body/zod";
const path = pathMaker(prefix);
const req = reqMaker(prefix);

const stringSchema = z.string();
const numberSchema = z.number();
const objectSchema = z.object({ name: z.string(), age: z.number() });
const arraySchema = z.array(z.string());
const booleanSchema = z.boolean();
const optionalKeySchema = z.object({
	required: z.string(),
	optional: z.string().optional(),
});
const nestedSchema = z.object({
	user: z.object({
		name: z.string(),
		address: z.object({
			city: z.string(),
			country: z.string(),
		}),
	}),
});
const enumSchema = z.object({
	status: z.enum(["active", "inactive", "pending"]),
});
const defaultValueSchema = z.object({
	name: z.string(),
	count: z.number().default(0),
});
const requiredStringSchema = z.object({ required: z.string() });
const requiredNumberSchema = z.object({ required: z.number() });
const constraintSchema = z.string().min(1);
const optionalSchema = z.string().optional();
const emailSchema = z.object({ email: z.email() });
const customMessageSchema = z.string().min(5, "Must be at least 5 characters");

describe("Request Body - Zod", () => {
	it("STRING", async () => {
		new Route({ method: "POST", path: path("/string") }, (c) => c.body, {
			body: stringSchema,
		});
		const res = await s.handle(
			req("/string", {
				method: "POST",
				body: "world",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
	});
	it("NUMBER", async () => {
		new Route({ method: "POST", path: path("/number") }, (c) => c.body, {
			body: numberSchema,
		});
		const res = await s.handle(
			req("/number", {
				method: "POST",
				body: "8",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
	});
	it("OBJECT", async () => {
		new Route({ method: "POST", path: path("/object") }, (c) => c.body, {
			body: objectSchema,
		});
		const res = await s.handle(
			req("/object", {
				method: "POST",
				body: JSON.stringify({ name: "John", age: 30 }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ name: "John", age: 30 });
	});
	it("ARRAY", async () => {
		new Route({ method: "POST", path: path("/array") }, (c) => c.body, {
			body: arraySchema,
		});
		const res = await s.handle(
			req("/array", {
				method: "POST",
				body: JSON.stringify(["apple", "banana", "cherry"]),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toBeArrayOfSize(3);
		expect(data).toEqual(["apple", "banana", "cherry"]);
	});
	it("BOOLEAN", async () => {
		new Route({ method: "POST", path: path("/boolean") }, (c) => c.body, {
			body: booleanSchema,
		});
		const res = await s.handle(
			req("/boolean", {
				method: "POST",
				body: "true",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("true");
	});
	it("OPTIONAL FIELD", async () => {
		new Route({ method: "POST", path: path("/optional") }, (c) => c.body, {
			body: optionalKeySchema,
		});
		const resRequired = await s.handle(
			req("/optional", {
				method: "POST",
				body: JSON.stringify({ required: "value" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(resRequired.status).toBe(200);
		const dataRequired = await resRequired.json();
		expect(dataRequired).toEqual({ required: "value" });
		const resOptional = await s.handle(
			req("/optional", {
				method: "POST",
				body: JSON.stringify({ required: "value", optional: "value" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(resOptional.status).toBe(200);
		const dataOptional = await resOptional.json();
		expect(dataOptional).toEqual({ required: "value", optional: "value" });
	});
	it("NESTED OBJECT", async () => {
		new Route({ method: "POST", path: path("/nested") }, (c) => c.body, {
			body: nestedSchema,
		});
		const res = await s.handle(
			req("/nested", {
				method: "POST",
				body: JSON.stringify({
					user: {
						name: "Alice",
						address: { city: "New York", country: "USA" },
					},
				}),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({
			user: { name: "Alice", address: { city: "New York", country: "USA" } },
		});
	});
	it("ENUM VALIDATION", async () => {
		new Route({ method: "POST", path: path("/enum") }, (c) => c.body, {
			body: enumSchema,
		});
		const res = await s.handle(
			req("/enum", {
				method: "POST",
				body: JSON.stringify({ status: "active" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ status: "active" });
	});
	it("WITH DEFAULT VALUES", async () => {
		new Route({ method: "POST", path: path("/default") }, (c) => c.body, {
			body: defaultValueSchema,
		});
		const res = await s.handle(
			req("/default", {
				method: "POST",
				body: JSON.stringify({ name: "test" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ name: "test", count: 0 });
	});
	it("INVALID DATA - SHOULD FAIL", async () => {
		new Route({ method: "POST", path: path("/invalid") }, (c) => c.body, {
			body: stringSchema,
		});
		const res = await s.handle(
			req("/invalid", {
				method: "POST",
				body: JSON.stringify({ not: "a string" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
	it("MISSING REQUIRED FIELD - SHOULD FAIL", async () => {
		new Route({ method: "POST", path: path("/missing") }, (c) => c.body, {
			body: requiredStringSchema,
		});
		const res = await s.handle(
			req("/missing", {
				method: "POST",
				body: JSON.stringify({ optional: "value" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
	it("WRONG TYPE - SHOULD FAIL", async () => {
		new Route({ method: "POST", path: path("/wrongtype") }, (c) => c.body, {
			body: requiredNumberSchema,
		});
		const res = await s.handle(
			req("/wrongtype", {
				method: "POST",
				body: JSON.stringify({ age: "not a number" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
	it("EMPTY BODY WITH REQUIRED SCHEMA - SHOULD FAIL", async () => {
		new Route({ method: "POST", path: path("/empty") }, (c) => c.body, {
			body: constraintSchema,
		});
		const res = await s.handle(
			req("/empty", {
				method: "POST",
				body: "",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
	it("EMPTY BODY WITH OPTIONAL SCHEMA - SHOULD PASS", async () => {
		new Route(
			{ method: "POST", path: path("/empty-optional") },
			(c) => c.body,
			{
				body: optionalSchema,
			},
		);
		const res = await s.handle(
			req("/empty-optional", {
				method: "POST",
				body: "",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
	});
	it("COERCION WITH DIFFERENT INPUT TYPES", async () => {
		new Route(
			{ method: "POST", path: path("/coerce") },
			(c) => ({ value: c.body, type: typeof c.body }),
			{ body: numberSchema },
		);
		const res = await s.handle(
			req("/coerce", {
				method: "POST",
				body: "42",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
	});
	it("VALIDATION WITH REGEX PATTERN", async () => {
		new Route({ method: "POST", path: path("/regex") }, (c) => c.body, {
			body: emailSchema,
		});
		const res = await s.handle(
			req("/regex", {
				method: "POST",
				body: JSON.stringify({ email: "test@example.com" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ email: "test@example.com" });
	});
	it("INVALID EMAIL FORMAT - SHOULD FAIL", async () => {
		new Route({ method: "POST", path: path("/invalid-email") }, (c) => c.body, {
			body: emailSchema,
		});
		const res = await s.handle(
			req("/invalid-email", {
				method: "POST",
				body: JSON.stringify({ email: "not-an-email" }),
				headers: { [CommonHeaders.ContentType]: "application/json" },
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
	it("CUSTOM VALIDATION MESSAGE", async () => {
		new Route(
			{ method: "POST", path: path("/custom-message") },
			(c) => c.body,
			{
				body: customMessageSchema,
			},
		);
		const res = await s.handle(
			req("/custom-message", {
				method: "POST",
				body: "short",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(res.status).toBe(200);
		const resFail = await s.handle(
			req("/custom-message", {
				method: "POST",
				body: "hi",
				headers: { [CommonHeaders.ContentType]: "text/plain" },
			}),
		);
		expect(resFail.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});
});

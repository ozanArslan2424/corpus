import { describe, expect, it } from "bun:test";
import { reqMaker } from "../utils/reqMaker";
import { pathMaker } from "../utils/pathMaker";
import z from "zod";
import { Status } from "@/internal/enums/Status";
import { Route } from "@/internal/modules/Route/Route";
import { Server } from "@/exports";

const s = new Server({});
const prefix = "/request-params/zod";
const path = pathMaker(prefix);
const req = reqMaker(prefix);

const stringSchema = z.object({ id: z.string() });
const numberSchema = z.object({ id: z.number() });
const booleanSchema = z.object({ id: z.boolean() });
const multipleSchema = z.object({ userId: z.string(), postId: z.number() });
const constraintsSchema = z.object({ id: z.string().min(3) });
const uuidSchema = z.object({ id: z.uuid() });
const emailSchema = z.object({ email: z.email() });
const numericRangeSchema = z.object({ age: z.number().min(1).max(149) });
const literalEnumSchema = z.object({
	status: z.enum(["active", "inactive", "pending"]),
});
const complexNestedSchema = z.object({
	category: z.string(),
	id: z.uuid(),
	version: z.number().min(1),
});
const dateSchema = z.object({ date: z.coerce.date() });
const regexSchema = z.object({ code: z.string().regex(/^[A-Z]{3}-[0-9]{4}$/) });
const typeAliasSchema = z.object({
	id: z.number().min(1),
	slug: z
		.string()
		.transform((v) => v.toLocaleLowerCase().replace(/[^a-z0-9-]/g, "")),
});
const requiredSchema = z.object({ required: z.string() });

describe("Request Params - Zod", () => {
	it("STRING", async () => {
		new Route(
			{ method: "GET", path: path("/string/:id") },
			(c) => c.params.id,
			{
				params: stringSchema,
			},
		);
		const param = "hello";
		const res = await s.handle(req(`/string/${param}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(param);
	});

	it("NUMBER", async () => {
		new Route(
			{ method: "GET", path: path("/number/:id") },
			(c) => c.params.id,
			{
				params: numberSchema,
			},
		);
		const param = 8;
		const res = await s.handle(req(`/number/${param}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text().then((data) => parseInt(data))).toBe(param);
	});

	it("BOOLEAN", async () => {
		new Route(
			{ method: "GET", path: path("/boolean/:id") },
			(c) => c.params.id,
			{
				params: booleanSchema,
			},
		);
		const param = true;
		const res = await s.handle(req(`/boolean/${param}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text().then((data) => data === "true")).toBe(param);
	});

	it("MULTIPLE PARAMS", async () => {
		new Route(
			{ method: "GET", path: path("/multiple/:userId/:postId") },
			(c) => c.params,
			{
				params: multipleSchema,
			},
		);
		const userId = "user123";
		const postId = 456;
		const res = await s.handle(
			req(`/multiple/${userId}/${postId}`, { method: "GET" }),
		);
		expect(res.status).toBe(200);
		const responseBody = await res.json();
		expect(responseBody).toEqual({ userId, postId });
	});

	it("PARAMS WITH CONSTRAINTS", async () => {
		new Route(
			{ method: "GET", path: path("/constraints/:id") },
			(c) => c.params.id,
			{
				params: constraintsSchema,
			},
		);
		const validId = "hello";
		const res = await s.handle(
			req(`/constraints/${validId}`, { method: "GET" }),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(validId);
	});

	it("PARAMS WITH INVALID CONSTRAINT - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/constraints-invalid/:id") },
			(c) => c.params.id,
			{
				params: constraintsSchema,
			},
		);
		const invalidId = "s";
		const res = await s.handle(
			req(`/constraints-invalid/${invalidId}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("UUID FORMAT", async () => {
		new Route({ method: "GET", path: path("/uuid/:id") }, (c) => c.params.id, {
			params: uuidSchema,
		});
		const uuid = "123e4567-e89b-12d3-a456-426614174000";
		const res = await s.handle(req(`/uuid/${uuid}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(uuid);
	});

	it("INVALID UUID - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/uuid-invalid/:id") },
			(c) => c.params.id,
			{
				params: uuidSchema,
			},
		);
		const invalidUuid = "not-a-uuid";
		const res = await s.handle(
			req(`/uuid-invalid/${invalidUuid}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("EMAIL FORMAT", async () => {
		new Route(
			{ method: "GET", path: path("/email/:email") },
			(c) => c.params.email,
			{
				params: emailSchema,
			},
		);
		const email = "test@example.com";
		const res = await s.handle(
			req(`/email/${encodeURIComponent(email)}`, { method: "GET" }),
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(email);
	});

	it("INVALID EMAIL - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/email-invalid/:email") },
			(c) => c.params.email,
			{
				params: emailSchema,
			},
		);
		const invalidEmail = "not-an-email";
		const res = await s.handle(
			req(`/email-invalid/${encodeURIComponent(invalidEmail)}`, {
				method: "GET",
			}),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("NUMERIC RANGE", async () => {
		new Route(
			{ method: "GET", path: path("/range/:age") },
			(c) => c.params.age,
			{
				params: numericRangeSchema,
			},
		);
		const validAge = 25;
		const res = await s.handle(req(`/range/${validAge}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text().then(Number)).toBe(validAge);
	});

	it("OUT OF RANGE - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/range-invalid/:age") },
			(c) => c.params.age,
			{
				params: numericRangeSchema,
			},
		);
		const invalidAge = 200;
		const res = await s.handle(
			req(`/range-invalid/${invalidAge}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("LITERAL VALUES", async () => {
		new Route(
			{ method: "GET", path: path("/literal/:status") },
			(c) => c.params.status,
			{
				params: literalEnumSchema,
			},
		);
		const status = "active";
		const res = await s.handle(req(`/literal/${status}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(status);
	});

	it("INVALID LITERAL - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/literal-invalid/:status") },
			(c) => c.params.status,
			{
				params: literalEnumSchema,
			},
		);
		const invalidStatus = "invalid";
		const res = await s.handle(
			req(`/literal-invalid/${invalidStatus}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("COMPLEX NESTED VALIDATION", async () => {
		new Route(
			{ method: "GET", path: path("/complex/:category/:id/:version") },
			(c) => c.params,
			{
				params: complexNestedSchema,
			},
		);
		const category = "products";
		const id = "123e4567-e89b-12d3-a456-426614174000";
		const version = 2;
		const res = await s.handle(
			req(`/complex/${category}/${id}/${version}`, { method: "GET" }),
		);
		expect(res.status).toBe(200);
		const responseBody = await res.json();
		expect(responseBody).toEqual({ category, id, version });
	});

	it("DATE STRING FORMAT", async () => {
		new Route(
			{ method: "GET", path: path("/date/:date") },
			(c) => c.params.date,
			{
				params: dateSchema,
			},
		);
		const date = "2024-01-01";
		const res = await s.handle(req(`/date/${date}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(new Date(date).toISOString());
	});

	it("INVALID DATE - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/date-invalid/:date") },
			(c) => c.params.date,
			{
				params: dateSchema,
			},
		);
		const invalidDate = "not-a-date";
		const res = await s.handle(
			req(`/date-invalid/${invalidDate}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("REGEX PATTERN", async () => {
		new Route(
			{ method: "GET", path: path("/regex/:code") },
			(c) => c.params.code,
			{
				params: regexSchema,
			},
		);
		const code = "ABC-1234";
		const res = await s.handle(req(`/regex/${code}`, { method: "GET" }));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(code);
	});

	it("INVALID REGEX PATTERN - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/regex-invalid/:code") },
			(c) => c.params.code,
			{
				params: regexSchema,
			},
		);
		const invalidCode = "abc-123";
		const res = await s.handle(
			req(`/regex-invalid/${invalidCode}`, { method: "GET" }),
		);
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
	});

	it("CUSTOM TYPE ALIAS", async () => {
		new Route(
			{ method: "GET", path: path("/custom/:id/:slug") },
			(c) => c.params,
			{
				params: typeAliasSchema,
			},
		);
		const id = 42;
		const slugValue = "my-slug-123";
		const res = await s.handle(
			req(`/custom/${id}/${slugValue}`, { method: "GET" }),
		);
		expect(res.status).toBe(200);
		const responseBody = await res.json();
		expect(responseBody).toEqual({ id, slug: slugValue });
	});

	it("MISSING REQUIRED PARAM - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/missing/:required") },
			(c) => c.params.required,
			{
				params: requiredSchema,
			},
		);
		const res = await s.handle(req(`/missing/`, { method: "GET" }));
		expect(res.status).toBe(Status.NOT_FOUND);
	});
});

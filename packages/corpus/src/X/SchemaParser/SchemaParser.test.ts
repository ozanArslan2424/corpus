import { beforeEach, describe, expect, it } from "bun:test";

import type { Schema, ValidationIssues } from "@ozanarslan/utils";
import { type } from "arktype";
import z from "zod";

import { createTestServer, parseBody, reqPath } from "#testutils";
import { Controller } from "@/C/Controller/Controller";
import { Exception } from "@/C/Exception/Exception";
import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import { Route } from "@/C/Route/Route";
import { joinPathSegments } from "@/C/RouteBase/joinPathSegments";
import { Status } from "@/C/Status/Status";
import { $registry } from "@/Registry/$registry";
import type { SchemaParser } from "@/X/SchemaParser/SchemaParser";

const GOOD = { hello: 1 };
const BAD = { unknown: "object" };

const s = createTestServer();

class TestModel {
	// primitives
	static ark = {
		number: type("number"),
	};
	static zod = {
		number: z.number(),
	};

	// standalone objects
	static arkObject = type({ hello: this.ark.number });
	static zodObject = z.object({ hello: this.zod.number });

	// route schemas (params/search coerce, body does not)
	static arkRoute = {
		params: type({ hello: this.ark.number }),
		search: type({ hello: this.ark.number }),
		body: type({ hello: this.ark.number }),
		response: type({
			params: type({ hello: this.ark.number }),
			search: type({ hello: this.ark.number }),
			body: type({ hello: this.ark.number }),
		}),
	};
	static zodRoute = {
		params: z.object({ hello: this.zod.number }),
		search: z.object({ hello: this.zod.number }),
		body: z.object({ hello: this.zod.number }),
	};

	static arkRouteReferenced = {
		params: type({ hello: this.ark.number }),
		search: this.arkRoute.search,
		body: this.arkObject,
	};
	static zodRouteReferenced = {
		params: z.object({ hello: this.zod.number }),
		search: this.zodRoute.search,
		body: this.zodObject,
	};

	static combined = {
		params: type({ hello: this.ark.number }),
		search: z.object({ hello: this.zod.number }),
		body: this.arkRoute.body,
	};
}

class TestParsingController extends Controller {
	constructor() {
		super("/controller");
	}

	arkRoute = this.route(
		{ method: "POST", path: "/arkRoute/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		TestModel.arkRoute,
	);
	arkRouteReferenced = this.route(
		{ method: "POST", path: "/arkRouteReferenced/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		TestModel.arkRouteReferenced,
	);
	zodRoute = this.route(
		{ method: "POST", path: "/zodRoute/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		TestModel.zodRoute,
	);
	zodRouteReferenced = this.route(
		{ method: "POST", path: "/zodRouteReferenced/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		TestModel.zodRouteReferenced,
	);
	combined = this.route(
		{ method: "POST", path: "/combined/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		TestModel.combined,
	);

	optional = this.route("/optional", (c) => c.search, {
		search: type({
			"groupId?": type("number | undefined").pipe((v) => (v ? Number(v) : v)),
		}),
	});

	missing = this.route("/missing/:param", (c) => c.params.param, {
		params: type({ param: "string" }),
	});
}

beforeEach(() => {
	$registry.reset();
	new TestParsingController();
});

const parser = $registry.schemaParser as SchemaParser;
const parse = (data: unknown, schema: Schema) => parser.parse("test", data, schema);

const postRoute = (
	routePath: string,
	{ param, search, body }: { param: string | number; search: string | number; body: any },
) => {
	const url = new URL(
		reqPath(joinPathSegments(...routePath.replace(/:hello/, String(param)).split("/"))),
	);
	url.searchParams.set("hello", search.toString());
	return s.handle(
		new Request(url, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { [HeaderKey.ContentType]: "application/json" },
		}),
	);
};

type RouteOutput = {
	params: typeof GOOD;
	search: typeof GOOD;
	body: typeof GOOD;
};

// Inline sync and async validators for parser.parseSync tests.
// These mimic the Standard Schema validator shape.
const syncSchema: Schema<typeof GOOD> = {
	"~standard": {
		validate: (input) => {
			if (input && typeof input === "object" && "hello" in input && input.hello === 1) {
				return { value: input as typeof GOOD };
			}
			return {
				value: undefined as never,
				issues: [{ message: "expected { hello: 1 }", path: ["hello"] }],
			};
		},
	} as Schema<typeof GOOD>["~standard"],
};

const asyncValidator: Schema<typeof GOOD> = {
	"~standard": {
		validate: async (input) => {
			if (input && typeof input === "object" && "hello" in input && input.hello === 1) {
				return { value: input as typeof GOOD };
			}
			return {
				value: undefined as never,
				issues: [{ message: "expected { hello: 1 }", path: ["hello"] }],
			};
		},
	} as Schema<typeof GOOD>["~standard"],
};

const thenableValidator: Schema<typeof GOOD> = {
	"~standard": {
		validate: (input: unknown) => ({
			then: (resolve: (v: unknown) => void) => resolve(syncSchema["~standard"].validate(input)),
		}),
	},
} as Schema<typeof GOOD>;

describe("Parser unit", () => {
	describe("success", () => {
		it("ark object", () => {
			expect(parse(GOOD, TestModel.arkObject)).resolves.toEqual(GOOD);
		});
		it("zod object", () => {
			expect(parse(GOOD, TestModel.zodObject)).resolves.toEqual(GOOD);
		});
		it("ark route — coerces params and search, passes body through", () => {
			expect(parse(GOOD, TestModel.arkRoute.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRoute.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRoute.body)).resolves.toEqual(GOOD);
		});
		it("zod route — coerces params and search, passes body through", () => {
			expect(parse(GOOD, TestModel.zodRoute.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRoute.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRoute.body)).resolves.toEqual(GOOD);
		});
		it("ark route (referenced schemas)", () => {
			expect(parse(GOOD, TestModel.arkRouteReferenced.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRouteReferenced.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.arkRouteReferenced.body)).resolves.toEqual(GOOD);
		});
		it("zod route (referenced schemas)", () => {
			expect(parse(GOOD, TestModel.zodRouteReferenced.params)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRouteReferenced.search)).resolves.toEqual(GOOD);
			expect(parse(GOOD, TestModel.zodRouteReferenced.body)).resolves.toEqual(GOOD);
		});
	});

	describe("failure", () => {
		it("ark object", () => {
			expect(parse(BAD, TestModel.arkObject)).rejects.toThrow(Exception);
		});
		it("zod object", () => {
			expect(parse(BAD, TestModel.zodObject)).rejects.toThrow(Exception);
		});
		it("ark route", () => {
			expect(parse(BAD, TestModel.arkRoute.params)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.arkRoute.search)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.arkRoute.body)).rejects.toThrow(Exception);
		});
		it("zod route", () => {
			expect(parse(BAD, TestModel.zodRoute.params)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.zodRoute.search)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.zodRoute.body)).rejects.toThrow(Exception);
		});
		it("ark route (referenced schemas)", () => {
			expect(parse(BAD, TestModel.arkRouteReferenced.params)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.arkRouteReferenced.search)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.arkRouteReferenced.body)).rejects.toThrow(Exception);
		});
		it("zod route (referenced schemas)", () => {
			expect(parse(BAD, TestModel.zodRouteReferenced.params)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.zodRouteReferenced.search)).rejects.toThrow(Exception);
			expect(parse(BAD, TestModel.zodRouteReferenced.body)).rejects.toThrow(Exception);
		});
	});

	describe("parser.parse — no validator", () => {
		it("returns data as-is when validator is undefined", () => {
			expect(parser.parse("test", GOOD, undefined)).resolves.toEqual(GOOD);
		});

		it("returns data as-is when validator is omitted", () => {
			expect(parser.parse("test", GOOD)).resolves.toEqual(GOOD);
		});

		it("preserves reference identity when no validator runs", async () => {
			const ref = { a: 1 };
			const result = await parser.parse("test", ref);
			expect(result).toBe(ref);
		});
	});

	describe("parser.parseSync", () => {
		it("returns data as-is when validator is undefined", () => {
			expect(parser.parseSync<typeof GOOD>("test", GOOD)).toEqual(GOOD);
		});

		it("returns validated value for sync validator on good input", () => {
			expect(parser.parseSync("test", GOOD, syncSchema)).toEqual(GOOD);
		});

		it("throws Exception for sync validator on bad input", () => {
			expect(() => parser.parseSync("test", BAD, syncSchema)).toThrow(Exception);
		});

		it("throws when given an async validator", () => {
			expect(() => parser.parseSync("test", GOOD, asyncValidator)).toThrow(
				"parseSync called with async validator",
			);
		});

		it("throws when given a thenable (non-Promise) validator", () => {
			expect(() => parser.parseSync("test", GOOD, thenableValidator)).toThrow(
				"parseSync called with async validator",
			);
		});
	});

	describe("parser.issuesToErrorMessage", () => {
		it("returns an empty string for no issues", () => {
			expect(parser.issuesToErrorMessage("body", {}, [])).toBe("");
		});

		it("returns the raw message for issues without a path", () => {
			const issues: ValidationIssues = [{ message: "invalid root" }];
			expect(parser.issuesToErrorMessage("body", {}, issues)).toBe("invalid root");
		});

		it("formats string-path issues with the received value", () => {
			const issues: ValidationIssues = [{ message: "expected number", path: ["hello"] }];
			expect(parser.issuesToErrorMessage("body", { hello: "oops" }, issues)).toBe(
				'in body hello (received "oops"): expected number',
			);
		});

		it("formats object-path issues using the key field", () => {
			const issues: ValidationIssues = [
				{
					message: "expected number",
					path: [{ key: "hello" } as unknown as string],
				},
			];
			expect(parser.issuesToErrorMessage("body", { hello: 42 }, issues)).toBe(
				"in body hello (received 42): expected number",
			);
		});

		it("joins nested path segments with dots", () => {
			const issues: ValidationIssues = [{ message: "expected string", path: ["user", "name"] }];
			expect(parser.issuesToErrorMessage("body", { user: { name: 123 } }, issues)).toBe(
				"in body user.name (received 123): expected string",
			);
		});

		it("omits received value when path does not resolve", () => {
			const issues: ValidationIssues = [{ message: "missing field", path: ["missing"] }];
			expect(parser.issuesToErrorMessage("body", {}, issues)).toBe(
				"in body missing: missing field",
			);
		});

		it("omits received value when traversal hits a non-object", () => {
			const issues: ValidationIssues = [{ message: "bad", path: ["a", "b"] }];
			expect(parser.issuesToErrorMessage("body", { a: "scalar" }, issues)).toBe("in body a.b: bad");
		});

		it("uses the label in the output", () => {
			const issues: ValidationIssues = [{ message: "expected number", path: ["id"] }];
			expect(parser.issuesToErrorMessage("params", { id: "x" }, issues)).toBe(
				'in params id (received "x"): expected number',
			);
		});

		it("joins multiple issues with newlines", () => {
			const issues: ValidationIssues = [
				{ message: "expected number", path: ["a"] },
				{ message: "expected string", path: ["b"] },
			];
			expect(parser.issuesToErrorMessage("body", { a: "x", b: 1 }, issues)).toBe(
				'in body a (received "x"): expected number\nin body b (received 1): expected string',
			);
		});
	});

	describe("real HTTP requests", () => {
		const schemaVariants = [
			["ark route", "/success/ark/:hello", TestModel.arkRoute],
			["zod route", "/success/zod/:hello", TestModel.zodRoute],
			["ark route (referenced)", "/success/arkRef/:hello", TestModel.arkRouteReferenced],
			["zod route (referenced)", "/success/zodRef/:hello", TestModel.zodRouteReferenced],
			["combined (ark + zod)", "/success/combined/:hello", TestModel.combined],
		] as const;

		describe("valid input — parses and coerces correctly", () => {
			for (const [name, path, schema] of schemaVariants) {
				it(name, async () => {
					new Route(
						{ method: "POST", path },
						(c) => ({ body: c.body, params: c.params, search: c.search }),
						schema,
					);
					const res = await postRoute(path, {
						param: GOOD.hello,
						search: GOOD.hello,
						body: GOOD,
					});
					expect(await parseBody<RouteOutput>(res)).toEqual({
						params: GOOD,
						search: GOOD,
						body: GOOD,
					});
				});
			}

			it("controller combined route", async () => {
				const res = await postRoute("/controller/combined/:hello", {
					param: GOOD.hello,
					search: GOOD.hello,
					body: GOOD,
				});
				expect(await parseBody<RouteOutput>(res)).toEqual({
					params: GOOD,
					search: GOOD,
					body: GOOD,
				});
			});
		});

		describe("invalid input — responds 422", () => {
			const failVariants = [
				["ark route", "/fail/ark/:hello", TestModel.arkRoute],
				["zod route", "/fail/zod/:hello", TestModel.zodRoute],
				["ark route (referenced)", "/fail/arkRef/:hello", TestModel.arkRouteReferenced],
				["zod route (referenced)", "/fail/zodRef/:hello", TestModel.zodRouteReferenced],
				["combined (ark + zod)", "/fail/combined/:hello", TestModel.combined],
			] as const;

			for (const [name, path, schema] of failVariants) {
				it(name, async () => {
					new Route(
						{ method: "POST", path },
						(c) => ({ body: c.body, params: c.params, search: c.search }),
						schema,
					);
					const res = await postRoute(path, {
						param: BAD.unknown,
						search: BAD.unknown,
						body: BAD,
					});
					expect(res.ok).toBe(false);
					expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY);
				});
			}
		});

		describe("controller edge cases", () => {
			it("optional search param — provided", async () => {
				const url = new URL(reqPath(joinPathSegments("controller", "optional")));
				url.searchParams.set("groupId", "8");
				const res = await s.handle(new Request(url));
				expect(await parseBody<{ groupId: number }>(res)).toEqual({
					groupId: 8,
				});
			});

			it("optional search param — omitted", async () => {
				const url = new URL(reqPath(joinPathSegments("controller", "optional")));
				const res = await s.handle(new Request(url));
				expect(await parseBody(res)).toBeEmptyObject();
			});

			it("missing required route param — fails", async () => {
				const url = new URL(reqPath(joinPathSegments("controller", "missing")));
				const res = await s.handle(new Request(url));
				expect(res.ok).toBe(false);
			});
		});
	});
});

import { beforeEach, describe, expect, it } from "bun:test";

import { joinPathSegments } from "@ozanarslan/utils/joinPathSegments";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { parseBody } from "./utils/parse";
import { reqPath } from "./utils/req";
import { TestModel } from "./utils/TestModel";
import { TestParsingController } from "./utils/TestParsingController";

const s = createTestServer();

const GOOD = { hello: 1 };
const BAD = { unknown: "object" };

beforeEach(() => {
	$registryTesting.reset();
	new TestParsingController();
});

// ─── helpers ─────────────────────────────────────────────────────────────────

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
			headers: { [TC.HeaderKey.ContentType]: "application/json" },
		}),
	);
};

type RouteOutput = {
	params: typeof GOOD;
	search: typeof GOOD;
	body: typeof GOOD;
};

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
				new TC.Route(
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
				new TC.Route(
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
				expect(res.status).toBe(TC.Status.UNPROCESSABLE_ENTITY);
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

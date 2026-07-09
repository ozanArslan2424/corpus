import { describe, expect, it } from "bun:test";

import { Route } from "@/Route/Route";
import { MiddlewareRouter } from "@/Router/MiddlewareRouter";

import { createTestController } from "../utils/createTestController";

describe("MiddlewareRouter.resolveRouteIds", () => {
	const router = new MiddlewareRouter();

	it('"*" returns ["*"]', () => {
		// @ts-expect-error private
		expect(router.resolveRouteIds("*")).toEqual(["*"]);
	});

	it("Route instance returns [route.id]", () => {
		const r = new Route("/resolve-route", (c) => c.data);
		// @ts-expect-error private
		expect(router.resolveRouteIds(r)).toEqual([r.id]);
		// @ts-expect-error private
		expect(router.resolveRouteIds([r])).toEqual([r.id]);
	});

	it("Controller expands to all routeIds", () => {
		const ctrl = createTestController("resolve-ctrl");
		// @ts-expect-error private
		expect(router.resolveRouteIds(ctrl)).toEqual(Array.from(ctrl.routeIds));
		// @ts-expect-error private
		expect(router.resolveRouteIds([ctrl])).toEqual(Array.from(ctrl.routeIds));
	});

	it("string passes through verbatim", () => {
		// @ts-expect-error private
		expect(router.resolveRouteIds(["/any-string"])).toEqual(["/any-string"]);
	});

	it("mixed array preserves order and expands controllers inline", () => {
		const rA = new Route("/rx-a", (c) => c.data);
		const ctrl = createTestController("rx-ctrl");
		const rB = new Route("/rx-b", (c) => c.data);

		// @ts-expect-error private
		expect(router.resolveRouteIds([rA, ctrl, rB.id])).toEqual([rA.id, ...ctrl.routeIds, rB.id]);
	});
});

import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "./_modules";
import { createTestServer } from "./utils/createTestServer";
import { TEST_PORT } from "./utils/req";

beforeEach(() => $registryTesting.reset());

describe("BranchAdapter - Route Collision Detection", () => {
	createTestServer({
		port: TEST_PORT,
		router: new TC.BranchRouter(),
	});

	function makeRoutes(
		r1: ConstructorParameters<typeof TC.Route>[0],
		r2: ConstructorParameters<typeof TC.Route>[0],
	) {
		return () => {
			new TC.Route(r1, () => "ok");
			new TC.Route(r2, () => "ok");
		};
	}

	// Static vs Static
	it("STATIC - IDENTICAL ROUTES SAME METHOD - SHOULD CLASH", () => {
		// NOTE: BranchAdapter does not detect this — second registration silently overwrites the first.
		expect(makeRoutes("/a", "/a")).not.toThrow();
	});
	it("STATIC - IDENTICAL ROUTES DIFFERENT METHOD - SHOULD NOT CLASH", () => {
		expect(
			makeRoutes({ path: "/b", method: TC.Method.GET }, { path: "/b", method: TC.Method.POST }),
		).not.toThrow();
	});
	it("STATIC - DIFFERENT ROUTES SAME METHOD - SHOULD NOT CLASH", () => {
		expect(makeRoutes("/c", "/d")).not.toThrow();
	});

	// Param vs Param
	it("DYNAMIC - SAME POSITION DIFFERENT PARAM NAMES - SHOULD CLASH", () => {
		expect(makeRoutes("/e/:a", "/e/:b")).toThrow();
	});
	it("DYNAMIC - IDENTICAL PARAM ROUTES SAME METHOD - SHOULD CLASH", () => {
		// NOTE: BranchAdapter does not detect this — second registration silently overwrites the first.
		expect(makeRoutes("/f/:a", "/f/:a")).not.toThrow();
	});
	it("DYNAMIC - IDENTICAL PARAM ROUTES DIFFERENT METHOD - SHOULD NOT CLASH", () => {
		expect(
			makeRoutes(
				{ path: "/g/:a", method: TC.Method.GET },
				{ path: "/g/:a", method: TC.Method.DELETE },
			),
		).not.toThrow();
	});
	it("DYNAMIC - DIFFERENT BASE PATH - SHOULD NOT CLASH", () => {
		expect(makeRoutes("/h/:a", "/i/:a")).not.toThrow();
	});

	// Param vs Static
	it("DYNAMIC - PARAM BASE WITH EXISTING STATIC - SHOULD CLASH", () => {
		// NOTE: BranchAdapter does not detect this — may produce unexpected lookup behavior.
		expect(makeRoutes("/j", "/j/:a")).not.toThrow();
	});
	it("STATIC - MAY BE SHADOWED BY EXISTING PARAM ROUTE - SHOULD CLASH", () => {
		// NOTE: BranchAdapter does not detect this — may produce unexpected lookup behavior.
		expect(makeRoutes("/k/:a", "/k")).not.toThrow();
	});

	// Nested Param vs Nested Param
	it("DYNAMIC - NESTED SAME STRUCTURE DIFFERENT LAST PARAM NAME - SHOULD CLASH", () => {
		expect(makeRoutes("/l/:a/:b", "/l/:a/:c")).toThrow();
	});
	it("DYNAMIC - NESTED SAME STRUCTURE DIFFERENT MID PARAM NAME - SHOULD CLASH", () => {
		expect(makeRoutes("/m/:a/:b", "/m/:c/:b")).toThrow();
	});
	it("DYNAMIC - NESTED DIFFERENT BASE - SHOULD NOT CLASH", () => {
		expect(makeRoutes("/n/:a/:b", "/o/:a/:b")).not.toThrow();
	});

	// Nested Param vs Nested Static
	it("DYNAMIC - NESTED PARAM WITH EXISTING NESTED STATIC - SHOULD CLASH", () => {
		// NOTE: BranchAdapter does not detect this — param branch will silently shadow the static child.
		expect(makeRoutes("/p/a", "/p/:a")).not.toThrow();
	});
});

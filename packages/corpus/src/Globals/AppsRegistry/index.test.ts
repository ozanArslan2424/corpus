import { afterEach, describe, expect, test } from "bun:test";

import { App } from "@/App";
import { Globals } from "@/Globals";
import { getNearestApp } from "@/Globals/AppsRegistry";

describe("App / getNearestApp", () => {
	afterEach(() => {
		Globals.set("apps", []);
	});

	test("throws when no App has been instantiated", () => {
		Globals.set("apps", []);
		expect(() => getNearestApp()).toThrow();
	});

	test("registers itself on construction and becomes the nearest app", () => {
		Globals.set("apps", []);
		const fresh = new App();
		expect(getNearestApp()).toBe(fresh);
	});

	test("returns the most recently constructed App as nearest", () => {
		Globals.set("apps", []);
		new App();
		const second = new App();
		expect(getNearestApp()).toBe(second);
	});
});

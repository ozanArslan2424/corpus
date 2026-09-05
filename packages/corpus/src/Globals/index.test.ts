import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { AppInterface } from "@/App";
import { Globals, type GlobalRegistry } from "@/Globals";
import type { ParsersRegistry } from "@/ParsersRegistry";

import pkg from "../../package.json";

// Snapshot + restore whatever "apps"/"parsers" held before each test,
// since Globals is a real shared singleton across the whole test run.
let hadApps: boolean;
let appsSnapshot: GlobalRegistry["apps"] | undefined;
let hadParsers: boolean;
let parsersSnapshot: GlobalRegistry["parsers"] | undefined;

beforeEach(() => {
	hadApps = Globals.has("apps");
	appsSnapshot = hadApps ? Globals.get("apps") : undefined;
	hadParsers = Globals.has("parsers");
	parsersSnapshot = hadParsers ? Globals.get("parsers") : undefined;

	Globals.delete("apps");
	Globals.delete("parsers");
});

afterEach(() => {
	Globals.delete("apps");
	Globals.delete("parsers");
	if (hadApps) Globals.set("apps", appsSnapshot as GlobalRegistry["apps"]);
	if (hadParsers) Globals.set("parsers", parsersSnapshot as GlobalRegistry["parsers"]);
});

const fakeApps = () => [] as unknown as Array<AppInterface>;
const fakeParsers = () => ({}) as unknown as ParsersRegistry;

describe("Globals.getSymbol", () => {
	test("returns a symbol namespaced with the package name", () => {
		const symbol = Globals.getSymbol("apps");
		expect(symbol.toString()).toBe(`Symbol(${pkg.name}:apps)`);
	});

	test("returns the same symbol for the same key (global registry)", () => {
		const a = Globals.getSymbol("apps");
		const b = Globals.getSymbol("apps");
		expect(a).toBe(b);
	});

	test("returns different symbols for different keys", () => {
		const a = Globals.getSymbol("apps");
		const b = Globals.getSymbol("parsers");
		expect(a).not.toBe(b);
	});
});

describe("Globals.create", () => {
	test("creates and returns the value from init on first call", () => {
		const value = fakeApps();
		const result = Globals.create("apps", () => value);
		expect(result).toBe(value);
	});

	test("does not call init again on subsequent calls, returns cached value", () => {
		let calls = 0;
		const init = () => {
			calls++;
			return fakeApps();
		};
		const first = Globals.create("apps", init);
		const second = Globals.create("apps", init);
		expect(calls).toBe(1);
		expect(first).toBe(second);
	});

	test("stores an empty array without recomputing", () => {
		let calls = 0;
		const init = () => {
			calls++;
			return [] as GlobalRegistry["apps"];
		};
		Globals.create("apps", init);
		const result = Globals.create("apps", init);
		expect(result).toEqual([]);
		expect(calls).toBe(1);
	});
});

describe("Globals.get", () => {
	test("returns the value previously set by create", () => {
		const value = fakeApps();
		Globals.create("apps", () => value);
		expect(Globals.get("apps")).toBe(value);
	});

	test("throws if the global was never created", () => {
		expect(() => Globals.get("apps")).toThrow();
	});

	test("throw message includes the key name", () => {
		expect(() => Globals.get("apps")).toThrow(/apps/);
	});
});

describe("Globals.set", () => {
	test("sets a value for a key that was never created", () => {
		const value = fakeApps();
		Globals.set("apps", value);
		expect(Globals.get("apps")).toBe(value);
	});

	test("overwrites a value previously set by create", () => {
		Globals.create("apps", () => fakeApps());
		const updated = fakeApps();
		Globals.set("apps", updated);
		expect(Globals.get("apps")).toBe(updated);
	});

	test("create does not override a value already set by set", () => {
		const manual = fakeApps();
		Globals.set("apps", manual);
		const result = Globals.create("apps", () => fakeApps());
		expect(result).toBe(manual);
	});
});

describe("Globals.has / Globals.delete", () => {
	test("has returns false before a global is created", () => {
		expect(Globals.has("apps")).toBe(false);
	});

	test("has returns true after set", () => {
		Globals.set("apps", fakeApps());
		expect(Globals.has("apps")).toBe(true);
	});

	test("delete removes the value so has returns false and get throws again", () => {
		Globals.set("apps", fakeApps());
		Globals.delete("apps");
		expect(Globals.has("apps")).toBe(false);
		expect(() => Globals.get("apps")).toThrow();
	});
});

describe("independence between keys", () => {
	test("setting apps does not affect parsers", () => {
		Globals.set("apps", fakeApps());
		expect(Globals.has("parsers")).toBe(false);
	});

	test("deleting apps does not affect parsers", () => {
		Globals.set("apps", fakeApps());
		Globals.set("parsers", fakeParsers());
		Globals.delete("apps");
		expect(Globals.has("parsers")).toBe(true);
	});
});

describe("cross-module-instance sharing (Symbol.for behavior)", () => {
	test("a value set via globalThis directly is visible to Globals.get", () => {
		const symbolKey = Globals.getSymbol("apps");
		const value = fakeApps();
		(globalThis as Record<symbol, unknown>)[symbolKey] = value;
		expect(Globals.get("apps")).toBe(value);
	});
});

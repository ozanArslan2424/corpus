import { afterEach, describe, expect, it } from "bun:test";

import { createCacheControlHeader } from "@/C/Headers/createCacheControlHeader";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());

describe("createCacheControlHeader", () => {
	it("serializes public", () => {
		expect(createCacheControlHeader({ public: true })).toBe("public");
	});

	it("serializes max age", () => {
		expect(createCacheControlHeader({ maxAge: 3600 })).toBe("max-age=3600");
	});

	it("serializes max age zero", () => {
		expect(createCacheControlHeader({ maxAge: 0 })).toBe("max-age=0");
	});

	it("serializes immutable", () => {
		expect(createCacheControlHeader({ immutable: true })).toBe("immutable");
	});

	it("serializes combination in order", () => {
		expect(
			createCacheControlHeader({
				immutable: true,
				maxAge: 31536000,
				public: true,
			}),
		).toBe("public, max-age=31536000, immutable");
	});

	it("no store short circuits everything", () => {
		expect(
			createCacheControlHeader({
				noStore: true,
				noCache: true,
				public: true,
				maxAge: 3600,
				immutable: true,
			}),
		).toBe("no-store");
	});

	it("no cache short circuits the rest", () => {
		expect(
			createCacheControlHeader({
				noCache: true,
				public: true,
				maxAge: 3600,
				immutable: true,
			}),
		).toBe("no-cache");
	});

	it("false flags are not serialized", () => {
		expect(
			createCacheControlHeader({
				public: false,
				immutable: false,
				noCache: false,
				noStore: false,
				maxAge: 60,
			}),
		).toBe("max-age=60");
	});

	it("empty directive serializes to empty string", () => {
		expect(createCacheControlHeader({})).toBe("");
	});
});

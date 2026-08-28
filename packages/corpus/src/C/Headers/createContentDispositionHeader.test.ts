import { afterEach, describe, expect, it } from "bun:test";

import { createContentDispositionHeader } from "@/C/Headers/createContentDispositionHeader";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());

describe("createContentDispositionHeader", () => {
	it("serializes disposition", () => {
		expect(createContentDispositionHeader({ disposition: "inline" })).toBe("inline");
	});

	it("serializes combination", () => {
		expect(
			createContentDispositionHeader({
				disposition: "inline",
				filename: "test.test",
			}),
		).toBe('inline; filename="test.test"');
	});
});

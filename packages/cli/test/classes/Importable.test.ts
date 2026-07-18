import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import path from "path";

import type { Config } from "@/config/Config";
import { defineConfig } from "@/config/defineConfig";
import type { PartialTsConfig } from "@/config/getTsConfig";
import type { Nullable } from "@/utils/types";

let mockConfig: Config;
let mockTsConfig: Nullable<PartialTsConfig>;

mock.module("@/config/getConfig", () => ({
	getConfig: () => mockConfig,
}));

mock.module("@/config/getTsConfig", () => ({
	getTsConfig: () => mockTsConfig,
}));

const { Importable } = await import("@/classes/Importable");

const testDir = __dirname;
spyOn(process, "cwd").mockReturnValue(testDir);

function baseConfig(overrides: Partial<Config> = {}): Config {
	return defineConfig({
		silent: true,
		casing: "pascal",
		main: "../other/app/startServer.ts",
		output: "../other/app/generated.ts",
		...overrides,
	});
}

beforeEach(() => {
	mockConfig = baseConfig();
	mockTsConfig = null;
});

describe("pascalName / camelName", () => {
	test("pascalName converts resourceName to PascalCase", () => {
		const importable = new Importable("user-thing", "service");
		expect(importable.pascalName).toBe("UserThing");
	});

	test("camelName converts resourceName to camelCase", () => {
		const importable = new Importable("user-thing", "service");
		expect(importable.camelName).toBe("userThing");
	});
});

describe("filePath — default template", () => {
	test("uses pascal casing by default", () => {
		mockConfig = baseConfig({ casing: "pascal" });
		const importable = new Importable("user-thing", "service");
		expect(path.extname(importable.filePath)).toBe(".ts");
		expect(path.basename(importable.filePath, ".ts")).toBe("UserThingService");
		expect(path.basename(path.dirname(importable.filePath))).toBe("UserThing");
	});

	test("uses kebab casing when configured", () => {
		mockConfig = baseConfig({ casing: "kebab" });
		const importable = new Importable("user-thing", "service");
		expect(path.basename(importable.filePath, ".ts")).toBe("user-thing-service");
		expect(path.basename(path.dirname(importable.filePath))).toBe("user-thing");
	});

	test("uses camel casing when configured", () => {
		mockConfig = baseConfig({ casing: "camel" });
		const importable = new Importable("user-thing", "service");
		expect(path.basename(importable.filePath, ".ts")).toBe("userThingService");
		expect(path.basename(path.dirname(importable.filePath))).toBe("userThing");
	});
});

describe("filePath — custom structure template", () => {
	test("uses a custom template when configured for the kind", () => {
		mockConfig = baseConfig({
			casing: "kebab",
			folderStructure: { service: "services/{resource}-service.ts" },
		});
		const importable = new Importable("user-thing", "service");
		expect(path.extname(importable.filePath)).toBe(".ts");
		expect(path.basename(importable.filePath, ".ts")).toBe("user-thing-service");
		expect(path.basename(path.dirname(importable.filePath))).toBe("services");
	});

	test("applies casing to every path segment, not just the filename", () => {
		mockConfig = baseConfig({
			casing: "pascal",
			folderStructure: { service: "generated/services/{resource}-service.ts" },
		});
		const importable = new Importable("user-thing", "service");
		const dir = path.dirname(importable.filePath);
		expect(path.basename(dir)).toBe("Services");
		expect(path.basename(path.dirname(dir))).toBe("Generated");
	});

	test("does not mangle the file extension when casing is applied", () => {
		mockConfig = baseConfig({
			casing: "pascal",
			folderStructure: { service: "{resource}-service.ts" },
		});
		const importable = new Importable("user-thing", "service");
		expect(path.extname(importable.filePath)).toBe(".ts");
	});

	test("falls back to the default template when structure has no entry for the kind", () => {
		mockConfig = baseConfig({
			casing: "kebab",
			folderStructure: { model: "models/{resource}-model.ts" },
		});
		const importable = new Importable("user-thing", "service");
		expect(path.basename(importable.filePath, ".ts")).toBe("user-thing-service");
		expect(path.basename(path.dirname(importable.filePath))).toBe("user-thing");
	});
});

describe("relPathFrom", () => {
	test("returns a relative path (starts with .) when no alias applies", () => {
		const importable = new Importable("user-thing", "service");
		const inFile = path.join(path.dirname(importable.filePath), "..", "index.ts");
		const rel = importable.importFrom(inFile);
		expect(rel.startsWith(".")).toBe(true);
	});

	test("computes ../ when inFile is in a nested sibling directory", () => {
		const importable = new Importable("user-thing", "service");
		const grandparent = path.dirname(path.dirname(importable.filePath));
		const inFile = path.join(grandparent, "controllers", "index.ts");
		const rel = importable.importFrom(inFile);
		expect(rel.startsWith("../")).toBe(true);
	});

	test("uses the alias from tsconfig when its target path includes the target dir", () => {
		mockTsConfig = { compilerOptions: { paths: { "@/*": ["../other/app/*"] } } };
		const importable = new Importable("user-thing", "service");
		const inFile = path.join(path.dirname(importable.filePath), "..", "index.ts");
		const rel = importable.importFrom(inFile);
		expect(rel.startsWith("@/")).toBe(true);
	});
});

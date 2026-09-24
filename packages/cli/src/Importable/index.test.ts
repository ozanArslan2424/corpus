import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import type { Config } from "@/Config/Config";

let config: Config;
let tsconfig: { compilerOptions?: { paths?: Record<string, string[]> } } | null;

mock.module("@/Config/getConfig", () => ({ getConfig: () => config }));
mock.module("@/Config/getTsConfig", () => ({ getTsConfig: () => tsconfig }));

const realLogger = await import("@/utils/logger");
mock.module("@/utils/logger", () => ({
	...realLogger,
	logFatal: (message: string) => {
		throw new Error(message);
	},
}));

const { Importable } = await import("@/Importable");

const originalCwd = process.cwd();
let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "importable-"));
	process.chdir(tmpDir);
	fs.mkdirSync("src");
	fs.writeFileSync("src/index.ts", "");
	config = { main: "src/index.ts", casing: "pascal" } as Config;
	tsconfig = null;
});

afterEach(() => {
	process.chdir(originalCwd);
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resource name parsing", () => {
	test("flat resource", () => {
		const imp = new Importable("jwt", "service");
		expect(imp.resourceBaseName).toBe("jwt");
		expect(imp.resourceDir).toBe("");
		expect(imp.resourcePath).toBe("jwt");
	});

	test("nested resource", () => {
		const imp = new Importable("auth/jwt", "service");
		expect(imp.resourceBaseName).toBe("jwt");
		expect(imp.resourceDir).toBe("auth");
		expect(imp.resourcePath).toBe("auth/jwt");
	});

	test("deeply nested resource", () => {
		const imp = new Importable("api/auth/jwt", "service");
		expect(imp.resourceBaseName).toBe("jwt");
		expect(imp.resourceDir).toBe("api/auth");
	});

	test("normalizes backslashes and stray slashes", () => {
		const imp = new Importable("/auth\\jwt/", "service");
		expect(imp.resourceBaseName).toBe("jwt");
		expect(imp.resourceDir).toBe("auth");
		expect(imp.resourcePath).toBe("auth/jwt");
	});
});

describe("names", () => {
	test("flat resource", () => {
		const imp = new Importable("jwt", "service");
		expect(imp.name).toBe("jwt-service");
		expect(imp.pascalName).toBe("JwtService");
		expect(imp.camelName).toBe("jwtService");
	});

	test("nested resource uses last segment only", () => {
		const imp = new Importable("auth/jwt", "service");
		expect(imp.name).toBe("jwt-service");
		expect(imp.pascalName).toBe("JwtService");
		expect(imp.camelName).toBe("jwtService");
	});
});

describe("filePath", () => {
	test("default template, flat", () => {
		expect(new Importable("jwt", "service").filePath).toBe("src/Jwt/JwtService.ts");
	});

	test("default template, nested", () => {
		expect(new Importable("auth/jwt", "service").filePath).toBe("src/Auth/Jwt/JwtService.ts");
	});

	test("default template, deeply nested", () => {
		expect(new Importable("api/auth/jwt", "service").filePath).toBe(
			"src/Api/Auth/Jwt/JwtService.ts",
		);
	});

	test("kind-first template puts resource path under kind folder", () => {
		config.folderStructure = { service: "{kind}s/{resource}.ts" };
		expect(new Importable("auth/jwt", "service").filePath).toBe("src/Services/Auth/Jwt.ts");
	});

	test("camel casing", () => {
		config.casing = "camel";
		expect(new Importable("auth/jwt", "service").filePath).toBe("src/auth/jwt/jwtService.ts");
	});

	test("kebab casing", () => {
		config.casing = "kebab";
		expect(new Importable("auth/jwt", "service").filePath).toBe("src/auth/jwt/jwt-service.ts");
	});
});

describe("exists", () => {
	test("reflects the file on disk", () => {
		const imp = new Importable("auth/jwt", "service");
		expect(imp.exists).toBe(false);

		fs.mkdirSync(path.dirname(imp.filePath), { recursive: true });
		fs.writeFileSync(imp.filePath, "");
		expect(imp.exists).toBe(true);
	});
});

describe("importFrom", () => {
	test("relative from main file", () => {
		expect(new Importable("auth/jwt", "service").importFrom("src/index.ts")).toBe(
			"./Auth/Jwt/JwtService",
		);
	});

	test("relative from sibling file", () => {
		expect(new Importable("auth/jwt", "service").importFrom("src/Auth/Jwt/JwtController.ts")).toBe(
			"./JwtService",
		);
	});

	test("relative from another resource folder", () => {
		expect(new Importable("auth/jwt", "service").importFrom("src/Users/UsersService.ts")).toBe(
			"../Auth/Jwt/JwtService",
		);
	});

	test("uses tsconfig alias when available", () => {
		tsconfig = { compilerOptions: { paths: { "@/*": ["./src/*"] } } };
		expect(new Importable("auth/jwt", "service").importFrom("src/index.ts")).toBe(
			"@/Auth/Jwt/JwtService",
		);
	});

	test("prefers the most specific alias", () => {
		tsconfig = {
			compilerOptions: {
				paths: {
					"@/*": ["src/*"],
					"@auth/*": ["src/Auth/*"],
				},
			},
		};
		expect(new Importable("auth/jwt", "service").importFrom("src/index.ts")).toBe(
			"@auth/Jwt/JwtService",
		);
	});
});

describe("target dir", () => {
	test("fails when main file is missing", () => {
		config.main = "src/missing.ts";
		expect(() => new Importable("auth/jwt", "service")).toThrow("Could not find main file");
	});
});

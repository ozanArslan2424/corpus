import fs from "fs";
import path from "path";

import { toPascalCase, toCamelCase, toKebabCase } from "@/utils/strings";

import type { Config } from "../config";

export class ImportsManager {
	constructor(
		private readonly config: Config,
		public readonly cwd: string,
	) {
		this.srcAlias = this.resolveSrcAlias();
		this.srcDir = this.resolveSrcDir();
		this.targetDir = this.resolveTargetDir();
	}

	private readonly MAIN_FILE_NAME = "main.ts";
	private readonly TYPES_FILE_NAME = "corpus.d.ts";
	private readonly TSCONFIG_FILE_NAME = "tsconfig.json";
	private readonly SRC_DIR_NAME = "src";
	private readonly FALLBACK_DIR_NAME = "corpus";

	get typesFilePath(): string {
		return path.join(this.targetDir, this.TYPES_FILE_NAME);
	}

	get mainFilePath(): string {
		return path.join(this.targetDir, this.MAIN_FILE_NAME);
	}

	convertCase(s: string): string {
		switch (this.config.casing) {
			case "pascal":
			default:
				return toPascalCase(s);
			case "camel":
				return toCamelCase(s);
			case "kebab":
				return toKebabCase(s);
		}
	}

	makeImportPath(inFile: string, importedFile: string): string {
		if (this.srcAlias && importedFile.startsWith(this.srcDir)) {
			const rel = importedFile.replace(this.srcDir, "").replace(/^\//, "").replace(/\.ts$/, "");
			return `${this.srcAlias}/${rel}`;
		} else {
			const rel = path.relative(path.dirname(inFile), importedFile).replace(/\.ts$/, "");
			return rel.startsWith(".") ? rel : `./${rel}`;
		}
	}

	srcAlias: string | null;
	resolveSrcAlias() {
		const tsconfigPath = path.join(this.cwd, this.TSCONFIG_FILE_NAME);
		if (!fs.existsSync(tsconfigPath)) {
			console.log(`No ${this.TSCONFIG_FILE_NAME} found, skipping path aliases`);
			return null;
		}
		const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
		const paths = tsconfig.compilerOptions?.paths ?? {};
		for (const [alias, targets] of Object.entries(paths)) {
			const target = (targets as string[])[0] ?? "";
			if (target.includes(this.SRC_DIR_NAME)) {
				return alias.replace("/*", "");
			}
		}
		return null;
	}

	srcDir: string;
	resolveSrcDir() {
		const srcDir = path.join(this.cwd, this.SRC_DIR_NAME);
		if (!fs.existsSync(srcDir)) {
			fs.mkdirSync(srcDir, { recursive: true });
			console.log(`📁 Created ${this.SRC_DIR_NAME} directory.`);
		}
		return srcDir;
	}

	targetDir: string;
	resolveTargetDir() {
		let targetDir: string;
		if (fs.existsSync(path.join(this.srcDir, this.MAIN_FILE_NAME))) {
			targetDir = path.join(this.srcDir, this.FALLBACK_DIR_NAME);
		} else {
			targetDir = this.srcDir;
			fs.mkdirSync(targetDir, { recursive: true });
		}
		return targetDir;
	}
}

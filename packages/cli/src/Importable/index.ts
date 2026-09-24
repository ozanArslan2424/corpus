import fs from "fs";
import path from "path";

import type { Config } from "@/Config/Config";
import { getConfig } from "@/Config/getConfig";
import { getTsConfig } from "@/Config/getTsConfig";
import { FileParser, type FileParserCallback } from "@/FileParser";
import { toPascalCase, toCamelCase, toKebabCase } from "@/internal/converters";
import { resolveCwdPath } from "@/internal/resolveCwdPath";
import type { OrString } from "@/utils/is";
import { logFatal } from "@/utils/logger";

export type ImportableKind = OrString<
	"model" | "service" | "controller" | "route" | "middleware" | "exception"
>;

export class Importable {
	constructor(
		readonly resourceName: string,
		readonly kind: ImportableKind,
	) {
		this.config = getConfig();
		this.targetDirPath = this.resolveTargetDir();
	}

	private readonly config: Config;
	private readonly targetDirPath: string;

	private get resourceSegments(): string[] {
		return this.resourceName.split(/[\\/]/).filter(Boolean);
	}

	get resourceBaseName(): string {
		return this.resourceSegments.at(-1) ?? this.resourceName;
	}

	get resourceDir(): string {
		return this.resourceSegments.slice(0, -1).join("/");
	}

	get resourcePath(): string {
		return this.resourceSegments.join("/");
	}

	get name(): string {
		return `${this.resourceBaseName}-${this.kind}`;
	}

	get pascalName(): string {
		return toPascalCase(this.name);
	}

	get camelName(): string {
		return toCamelCase(this.name);
	}

	get filePath(): string {
		const template = this.config.folderStructure?.[this.kind] ?? "{resource}/{resource}-{kind}.ts";
		const relPath = template
			.replace("{resource}", this.resourcePath)
			.replaceAll("{resource}", this.resourceBaseName)
			.replaceAll("{kind}", this.kind)
			.split("/")
			.map((segment) => {
				const ext = path.extname(segment);
				const base = ext ? segment.slice(0, -ext.length) : segment;
				return this.convertCase(base) + ext;
			})
			.join("/");
		return path.join(path.relative(process.cwd(), this.targetDirPath), relPath);
	}

	get exists(): boolean {
		return fs.existsSync(this.filePath);
	}

	parseFile(cb: FileParserCallback) {
		const fileParser = new FileParser(this.filePath);
		return fileParser.runCallback(cb);
	}

	importFrom(inFile: string): string {
		const alias = this.resolveAliasFor(this.filePath);
		if (alias) return alias;
		const rel = path.relative(path.dirname(inFile), this.filePath).replace(/\.ts$/, "");
		return rel.startsWith(".") ? rel : `./${rel}`;
	}

	private resolveAliasFor(filePath: string): string | null {
		const tsconfig = getTsConfig();
		if (!tsconfig) return null;
		const paths = tsconfig.compilerOptions?.paths ?? {};
		const fileNoExt = filePath.replace(/\.ts$/, "").replace(/^\.\//, "");
		let bestAlias: string | null = null;
		let bestTargetLen = -1;
		for (const [alias, targets] of Object.entries(paths)) {
			const target = targets[0] ?? "";
			const targetDir = target.replace(/\/\*$/, "").replace(/^\.\//, "");
			if (!fileNoExt.startsWith(targetDir)) continue;
			if (targetDir.length <= bestTargetLen) continue;
			bestTargetLen = targetDir.length;
			const aliasPrefix = alias.replace(/\/\*$/, "");
			const rest = fileNoExt.slice(targetDir.length).replace(/^\//, "");
			bestAlias = rest ? `${aliasPrefix}/${rest}` : aliasPrefix;
		}
		return bestAlias;
	}

	private resolveTargetDir() {
		const mainPath = resolveCwdPath(this.config.main);
		if (!fs.existsSync(mainPath)) {
			logFatal(`Could not find main file at ${mainPath}.`);
		}
		return path.dirname(mainPath);
	}

	private convertCase(s: string): string {
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
}

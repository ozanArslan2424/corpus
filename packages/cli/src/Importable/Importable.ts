import fs from "node:fs";
import path from "node:path";

import { toCamelCase, toPascalCase } from "@/utils/strings";

import type { ImportsManager } from "../ImportsManager/ImportsManager";
import type { ImportableInterface } from "./ImportableInterface";

export class Importable implements ImportableInterface {
	constructor(
		private readonly im: ImportsManager,
		private readonly key: string,
		private readonly moduleName: string,
	) {
		const dir = path.join(im.targetDir, moduleName);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	}

	get name(): string {
		return toPascalCase(this.key);
	}

	get camelName(): string {
		return toCamelCase(this.key);
	}

	get fileName(): string {
		return this.im.convertCase(this.key) + ".ts";
	}

	get filePath(): string {
		return path.join(this.im.targetDir, this.im.convertCase(this.moduleName), this.fileName);
	}

	import(inFile: string): string {
		return this.im.makeImportPath(inFile, this.filePath);
	}
}

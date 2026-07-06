import { toPascalCase } from "@/utils/strings";

import { Importable } from "../Importable/Importable";
import type { ImportableInterface } from "../Importable/ImportableInterface";
import type { ImportsManager } from "../ImportsManager/ImportsManager";
import type { ModuleInterface } from "./ModuleInterface";

export class Module implements ModuleInterface {
	constructor(im: ImportsManager, moduleName: string) {
		this.name = toPascalCase(moduleName);

		this.model = new Importable(im, `${this.name}Model`, this.name);
		this.modelTypeName = `${this.name}Type`;

		this.controller = new Importable(im, `${this.name}Controller`, this.name);

		this.service = new Importable(im, `${this.name}Service`, this.name);

		this.repository = new Importable(im, `${this.name}Repository`, this.name);
	}

	public readonly name: string;

	public readonly model: ImportableInterface;
	public readonly modelTypeName: string;

	public readonly controller: ImportableInterface;

	public readonly service: ImportableInterface;

	public readonly repository: ImportableInterface;
}

import type { OrString } from "@ozanarslan/corpus";

import { Importable } from "@/classes/Importable";
import type { Config } from "@/config/Config";
import { getConfig } from "@/config/getConfig";
import { isNil } from "@/utils/is";
import { toPascalCase, toCamelCase, toKebabCase, quote } from "@/utils/strings";

export class Resource {
	constructor(key: string) {
		this.config = getConfig();
		this.pascalName = toPascalCase(key);
		this.camelName = toCamelCase(key);
		this.kebabName = toKebabCase(key);
		this.model = new Importable(key, "model");
		this.modelTypeName = `${this.model.pascalName}Type`;
		this.service = new Importable(key, "service");
		this.controller = new Importable(key, "controller");
		this.exception = new Importable(key, "exception");
	}

	private readonly config: Config;
	readonly pascalName: string;
	readonly camelName: string;
	readonly kebabName: string;
	readonly model: Importable;
	readonly modelTypeName: string;
	readonly service: Importable;
	readonly controller: Importable;
	readonly exception: Importable;

	type(
		methodKey: keyof Config["defaultMethods"] | "entity",
		...accessors: Array<OrString<"search" | "params" | "body" | "response">>
	): string {
		const ms = this.config.defaultMethods;
		return `${this.modelTypeName}[${quote(methodKey === "entity" ? "entity" : ms[methodKey].propertyKey)}]${accessors.map((accessor) => `[${quote(accessor)}]`)}`;
	}

	route(methodKey: keyof Config["defaultMethods"], body: string): string {
		const ms = this.config.defaultMethods;
		const noValLib = isNil(this.config.validationLibrary);
		const order = ["body", "search", "params", "response"];
		const generics = noValLib
			? `<${order.map((acc) => `\n\t\t${this.type(methodKey, acc)}`).join(",")}\n\t>`
			: ``;
		const baseArgs = `${quote(ms[methodKey].address)}, ${body}`;
		return `${ms[methodKey].propertyKey} = this.route${generics}(${baseArgs}${noValLib ? `` : `, ${this.model.pascalName}.${ms[methodKey].propertyKey}`})`;
	}
}

import { assert, StringBuilder, quote, isNil } from "@ozanarslan/corpus/utils";

import { Importable } from "@/classes/Importable";
import type { Config } from "@/config/Config";
import { EXE_NAME, NAME_FLAG_HELP } from "@/constants";
import { ModuleAbstract } from "@/modules/ModuleAbstract";

export class AddModelModule extends ModuleAbstract {
	override keys: string[] = ["model", "mdl"];
	override get help(): string[] {
		return [
			"Scaffold a standalone model with a default CRUD-shaped interface or schema.",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the model to generate.`,
			"  --empty             Generate a bare model with no default CRUD shape.",
			"",
			"Note: this only generates the model file and does not touch any other files.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);

		const model = new Importable(name, "model");
		const modelTypeName = `${model.pascalName}Type`;

		this.writeFile(this.buildModelFile(model, modelTypeName), [model.filePath]);
	}

	buildModelFile(model: Importable, modelTypeName: string): string {
		if (this.flags.empty) {
			return this.buildEmptyModelFile(model);
		}

		return this.buildModelFileWithDefaults(model, modelTypeName);
	}

	private buildEmptyModelFile(model: Importable) {
		const b = new StringBuilder();

		b.line(`export interface ${model.pascalName}Type {`);
		b.line(1)(`entity: {`);
		b.line(2)(`id: string;`);
		b.line(1)(`};`);
		b.line(`}`);

		return b.toString();
	}

	private buildModelFileWithDefaults(model: Importable, modelTypeName: string): string {
		const ms = this.config.defaultMethods;
		const validationLibrary = this.config.validationLibrary;

		const type = (
			methodKey: keyof Config["defaultMethods"] | "entity",
			...accessors: string[]
		): string => {
			const key = methodKey === "entity" ? "entity" : ms[methodKey].propertyKey;
			return `${modelTypeName}[${quote(key)}]${accessors.map((accessor) => `[${quote(accessor)}]`).join("")}`;
		};

		if (isNil(validationLibrary)) {
			return `export interface ${modelTypeName} {
    entity: {
        id: string;
        name: string;
    };

    ${ms.get.propertyKey}: {
        search: {
            page?: number;
            limit?: number;
        };
        response: {
            data: Array<${type("entity")}>;
            page: number;
            limit: number;
            count: number;
            totalCount: number;
            pageCount: number;
        };
        params: never;
        body: never;
    };

    ${ms.getByParams.propertyKey}: {
        params: {
            id: string;
        };
        response: ${type("entity")};
        search: never;
        body: never;
    };

    ${ms.create.propertyKey}: {
        body: {
            name: string;
        };
        response: ${type("entity")};
        search: never;
        params: never;
    }

    ${ms.update.propertyKey}: {
        body: Partial<${type("create", "body")}>;
        response: ${type("entity")};
        params: ${type("getByParams", "params")};
        search: never;
    };

    ${ms.remove.propertyKey}: {
        params: ${type("getByParams", "params")};
        response: void;
        body: never;
        search: never;
    };
};`;
		}

		const schemas = this.getSchemas(validationLibrary);

		return `${schemas.import}
import type { X } from ${quote(this.config.pkgPath)};

export type ${modelTypeName} = X.InferModel<typeof ${model.pascalName}>

export abstract class ${model.pascalName} {${validationLibrary === "yup" ? `\n\tstatic readonly never = y.mixed().oneOf([undefined] as const);\n` : ``}
    static readonly entity = ${schemas.entity};

    static readonly ${ms.get.propertyKey} = ${schemas.get};

    static readonly ${ms.getByParams.propertyKey} = ${schemas.getByParams};

    static readonly ${ms.create.propertyKey} = ${schemas.create};

    static readonly ${ms.update.propertyKey} = ${schemas.update};

    static readonly ${ms.remove.propertyKey} = ${schemas.remove};
}`;
	}

	private getSchemas(validationLibrary: NonNullable<Config["validationLibrary"]>) {
		switch (validationLibrary) {
			case "zod":
				return {
					import: `import * as z from "zod";`,
					entity: `z.object({
		id: z.string(),
		name: z.string(),
	})`,
					get: `{
		body: z.never(),
		search: z.object({
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
		params: z.never(),
		response: z.object({
			data: z.array(this.entity),
			page: z.number(),
			limit: z.number(),
			count: z.number(),
			totalCount: z.number(),
			pageCount: z.number(),
		}),
	}`,
					getByParams: `{
		body: z.never(),
		search: z.never(),
		params: z.object({
			id: z.string(),
		}),
		response: this.entity,
	}`,
					create: `{
		body: z.object({
			name: z.string(),
		}),
		search: z.never(),
		params: z.never(),
		response: this.entity,
	}`,
					update: `{
		body: this.create.body.partial(),
		search: z.never(),
		params: this.getByParams.params,
		response: this.entity,
	}`,
					remove: `{
		body: z.never(),
		search: z.never(),
		params: this.getByParams.params,
		response: z.void(),
	}`,
				};
			case "yup":
				return {
					import: `import * as y from "yup";`,
					entity: `y.object({
		id: y.string().required(),
		name: y.string().required(),
	})`,
					get: `{
		body: this.never,
		search: y.object({
			page: y.number().optional(),
			limit: y.number().optional(),
		}),
		params: this.never,
		response: y.object({
			data: y.array(this.entity).required(),
			page: y.number().required(),
			limit: y.number().required(),
			count: y.number().required(),
			totalCount: y.number().required(),
			pageCount: y.number().required(),
		}),
	}`,
					getByParams: `{
		body: this.never,
		search: this.never,
		params: y.object({
			id: y.string().required(),
		}),
		response: this.entity,
	}`,
					create: `{
		body: y.object({
			name: y.string().required(),
		}),
		search: this.never,
		params: this.never,
		response: this.entity,
	}`,
					update: `{
		body: this.create.body.partial(),
		search: this.never,
		params: this.getByParams.params,
		response: this.entity,
	}`,
					remove: `{
		body: this.never,
		search: this.never,
		params: this.getByParams.params,
		response: undefined,
	}`,
				};
			case "arktype":
				return {
					import: `import { type } from "arktype";`,
					entity: `type({
		id: "string",
		name: "string",
	})`,
					get: `{
		body: type("never"),
		search: type({
			"page?": "number",
			"limit?": "number",
		}),
		params: type("never"),
		response: type({
			data: this.entity.array(),
			page: type("number"),
			limit: type("number"),
			count: type("number"),
			totalCount: type("number"),
			pageCount: type("number"),
		}),
	}`,
					getByParams: `{
		body: type("never"),
		search: type("never"),
		params: type({
			id: type("string"),
		}),
		response: this.entity,
	}`,
					create: `{
		body: type({
			name: type("string"),
		}),
		search: type("never"),
		params: type("never"),
		response: this.entity,
	}`,
					update: `{
		body: this.create.body.partial(),
		search: type("never"),
		params: this.getByParams.params,
		response: this.entity,
	}`,
					remove: `{
		body: type("never"),
		search: type("never"),
		params: this.getByParams.params,
	}`,
				};
		}
	}
}

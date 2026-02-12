import { ParserAbstract } from "@/internal/modules/Parser/ParserAbstract";
import type { ParserInterface } from "@/internal/modules/Parser/ParserInterface";
import { ParserUsingArktype } from "@/internal/modules/Parser/ParserUsingArktype";
import { ParserUsingZod } from "@/internal/modules/Parser/ParserUsingZod";

import type { SchemaType } from "@/internal/types/SchemaType";

import { Type } from "arktype";
import { ZodType } from "zod";

export class Parser extends ParserAbstract implements ParserInterface {
	private readonly zod = new ParserUsingZod();
	private readonly arktype = new ParserUsingArktype();

	parse<O>(data: unknown, schema: SchemaType<O>, errorMessage: string): O {
		if (schema instanceof Type) {
			return this.arktype.parse(data, schema, errorMessage);
		}

		if (schema instanceof ZodType) {
			return this.zod.parse(data, schema, errorMessage);
		}

		this.logger.log((schema as any).toString());
		throw new Error(
			"Unsupported parser, currently only zod and ArkType are supported.",
		);
	}

	toJsonSchema(schema: SchemaType) {
		if (schema instanceof Type) {
			return this.arktype.toJsonSchema(schema);
		}

		if (schema instanceof ZodType) {
			return this.zod.toJsonSchema(schema);
		}

		throw new Error(
			"Unsupported parser, currently only zod and ArkType are supported.",
		);
	}
}

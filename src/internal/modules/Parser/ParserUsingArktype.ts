import { Status } from "@/internal/enums/Status";
import { CoreumError } from "@/internal/modules/CoreumError/CoreumError";
import { ParserAbstract } from "@/internal/modules/Parser/ParserAbstract";
import type { ParserInterface } from "@/internal/modules/Parser/ParserInterface";
import { type, type Type } from "arktype";

export class ParserUsingArktype
	extends ParserAbstract
	implements ParserInterface
{
	parse<O>(data: unknown, schema: Type<O>, errorMessage: string): O {
		const result = schema(data);
		if (result instanceof type.errors) {
			throw new CoreumError(
				errorMessage,
				Status.UNPROCESSABLE_ENTITY,
				result.toTraversalError(),
			);
		} else {
			return result as O;
		}
	}

	toJsonSchema(schema: Type): Record<string, unknown> {
		const jsonSchema = schema.toJsonSchema({
			target: "draft-2020-12",
			fallback: {
				default: (ctx) => ctx.base,
				date: (ctx) => ({
					...ctx.base,
					type: "string",
					format: "date-time",
					description: "anytime",
				}),
			},
		});

		return jsonSchema as Record<string, unknown>;
	}
}

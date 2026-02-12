import { Status } from "@/internal/enums/Status";
import { CoreumError } from "@/internal/modules/CoreumError/CoreumError";
import { ParserAbstract } from "@/internal/modules/Parser/ParserAbstract";
import type { ParserInterface } from "@/internal/modules/Parser/ParserInterface";
import { ZodType } from "zod";

export class ParserUsingZod extends ParserAbstract implements ParserInterface {
	parse<O>(data: unknown, schema: ZodType<O>, errorMessage: string): O {
		const result = schema.safeParse(data);
		if (!result.success) {
			throw new CoreumError(
				errorMessage,
				Status.UNPROCESSABLE_ENTITY,
				result.error,
			);
		}
		return result.data as O;
	}

	toJsonSchema(schema: ZodType): Record<string, unknown> {
		const jsonSchema = schema.toJSONSchema({
			target: "draft-2020-12",
			unrepresentable: "any",
			override: (ctx) => {
				const def = ctx.zodSchema._zod.def;
				if (def.type === "date") {
					ctx.jsonSchema.type = "string";
					ctx.jsonSchema.format = "date-time";
					ctx.jsonSchema.description = "anytime";
				}
			},
		});

		return jsonSchema as Record<string, unknown>;
	}
}

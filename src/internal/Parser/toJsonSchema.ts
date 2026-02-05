import { Type } from "arktype";
import { ZodType } from "zod";
// TODO:
export function toJsonSchema<S>(schema: S) {
	if (schema instanceof Type) {
		return schema.toJsonSchema({
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
	}

	if (schema instanceof ZodType) {
		return schema.toJSONSchema({
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
	}

	throw new Error(
		"Unsupported parser, currently only zod and ArkType are supported.",
	);
}

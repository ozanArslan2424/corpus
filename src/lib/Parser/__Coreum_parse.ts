import type { __Coreum_InferSchema } from "@/lib/Parser/__Coreum_InferSchema";
import type { __Coreum_SchemaType } from "@/lib/Parser/__Coreum_SchemaType";
import { type, Type } from "arktype";
import { ZodType } from "zod";

export function __Coreum_parse<O>(
	data: unknown,
	schema: __Coreum_SchemaType<O>,
	errorMessage: string,
): O {
	if (schema instanceof Type) {
		const result = schema(data);
		if (result instanceof type.errors) {
			throw new Error(errorMessage, result.toTraversalError());
		} else {
			return result as O;
		}
	}

	if (schema instanceof ZodType) {
		const result = schema.safeParse(data);
		if (!result.success) {
			throw new Error(errorMessage, result.error);
		}
		return result.data as O;
	}

	throw new Error(
		"Unsupported parser, currently only zod and ArkType are supported.",
	);
}

export { ArkErrors as ArkException } from "arktype";
export { ZodError as ZodException } from "zod";

export { Type as ArkSchema } from "arktype";
export { ZodType as ZodSchema } from "zod";

import { Type as ArkSchema } from "arktype";
import { ZodType as ZodSchema } from "zod";
export type Schema<T = unknown> = ZodSchema<T> | ArkSchema<T>;

export type InferZod<T extends ZodSchema> = T["_zod"]["output"];
export type InferArk<T extends ArkSchema> = T["infer"];
export type InferSchema<T> = T extends ZodSchema
	? InferZod<T>
	: T extends ArkSchema
		? InferArk<T>
		: never;

import { ArkErrors as ArkException } from "arktype";
import { ZodError as ZodException } from "zod";
export type SchemaError<T = unknown> = ZodException<T> | ArkException;
export type Validator<T = unknown> = (data: unknown) => T;

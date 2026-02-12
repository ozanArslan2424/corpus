import type { Type } from "arktype";
import type { ZodType, output } from "zod";

// prettier-ignore
export type InferSchema<T> = 
	T extends Type ? T["inferOut"] : 
	T extends ZodType ? output<T> : 
	never;

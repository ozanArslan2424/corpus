// import type z from "zod";
//
// //  prettier-ignore
// export type __Coreum_InferSchema<T> =
// 	// arktype
// 	T extends { inferOut: infer U } ? U :
// 	// other
// 	T extends { _type: infer U } ? U :
// 	// parser functions (also zod)
// 	T extends { parse: (data: unknown) => infer U } ? U :
// 	// parseum
// 	T extends { parseFn: (data: unknown) => infer U } ? U :
// 	// zod
// 	T extends { _zod: any } ? z.output<T> :
// 	// never
// 	never

import { Type } from "arktype";
import type { output, ZodType } from "zod";

// prettier-ignore
export type __Coreum_InferSchema<T> =
	T extends Type ? T["inferOut"] :
	T extends ZodType ? output<T> :
	never

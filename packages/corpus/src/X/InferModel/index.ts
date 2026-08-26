import type { InferSchemaOut, Schema, Prettify } from "@ozanarslan/utils";

import type { RouteModel } from "@/C/Route/types";

/** If you prefer to put all schemas into a single object, this will be helpful */
export type InferModel<T extends Record<string, any>> = {
	[K in keyof T as K extends "prototype" ? never : K]: T[K] extends RouteModel<any, any, any, any>
		? Prettify<
				(T[K]["body"] extends Schema ? { body: InferSchemaOut<T[K]["body"]> } : {}) &
					(T[K]["search"] extends Schema ? { search: InferSchemaOut<T[K]["search"]> } : {}) &
					(T[K]["params"] extends Schema ? { params: InferSchemaOut<T[K]["params"]> } : {}) &
					(T[K]["response"] extends Schema ? { response: InferSchemaOut<T[K]["response"]> } : {})
			>
		: T[K] extends Schema
			? InferSchemaOut<T[K]>
			: never;
};

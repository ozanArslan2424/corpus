import type { InferSchema } from "@/Model/types/InferSchema";
import type { Prettify } from "@/utils/types/Prettify";
import type { RouteModel } from "@/Model/types/RouteModel";
import type { Schema } from "@/Model/types/Schema";

/** If you prefer to put all schemas into a single object, this will be helpful */
export type InferModel<T extends Record<string, any>> = {
	[K in keyof T]: T[K] extends RouteModel<any, any, any, any>
		? Prettify<
				(T[K]["body"] extends Schema
					? { body: InferSchema<T[K]["body"]> }
					: {}) &
					(T[K]["search"] extends Schema
						? { search: InferSchema<T[K]["search"]> }
						: {}) &
					(T[K]["params"] extends Schema
						? { params: InferSchema<T[K]["params"]> }
						: {}) &
					(T[K]["response"] extends Schema
						? { response: InferSchema<T[K]["response"]> }
						: {})
			>
		: T[K] extends Schema
			? InferSchema<T[K]>
			: never;
};

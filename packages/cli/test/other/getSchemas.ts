import type { Nullable } from "@ozanarslan/corpus/utils";

import { getArkSchemas } from "./getArkSchemas";
import { getYupSchemas } from "./getYupSchemas";
import { getZodSchemas } from "./getZodSchemas";

export function getSchemas(lib: Nullable<"zod" | "arktype" | "yup">) {
	switch (lib) {
		case "zod":
			return getZodSchemas();

		case "yup":
			return getYupSchemas();

		case "arktype":
		case null:
		default:
			return getArkSchemas();
	}
}

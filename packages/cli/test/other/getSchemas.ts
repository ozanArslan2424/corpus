import type { ValidationLib } from "@/constants";

import { getArkSchemas } from "./getArkSchemas";
import { getYupSchemas } from "./getYupSchemas";
import { getZodSchemas } from "./getZodSchemas";

export function getSchemas(lib: ValidationLib) {
	switch (lib) {
		case "zod":
			return getZodSchemas();
		case "arktype":
		case null:
		default:
			return getArkSchemas();
		case "yup":
			return getYupSchemas();
	}
}

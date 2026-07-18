import { ArkSchemaPrinter } from "@/schema/ArkSchemaPrinter";
import { YupSchemaPrinter } from "@/schema/YupSchemaPrinter";
import { ZodSchemaPrinter } from "@/schema/ZodSchemaPrinter";

import type { Schema } from "./Schema";

export class SchemaPrinter {
	private readonly ark = new ArkSchemaPrinter();
	private readonly zod = new ZodSchemaPrinter();
	private readonly yup = new YupSchemaPrinter();

	print(schema: Schema, io: "in" | "out"): Error | string {
		if (!("~standard" in schema)) {
			return new Error(`Schema doesn't have "~standard" property.`);
		}
		if (!("vendor" in schema["~standard"])) {
			return new Error(`Schema doesn't have ["~standard"].vendor property.`);
		}

		try {
			switch (schema["~standard"].vendor) {
				case "zod":
					return this.zod.print(schema, io);
				case "yup":
					return this.yup.print(schema, io);
				case "arktype":
				default:
					return this.ark.print(schema, io);
			}
		} catch (err) {
			return err as Error;
		}
	}
}

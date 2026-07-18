import type { Schema } from "@/schema/Schema";
import { SchemaPrinterAbstract } from "@/schema/SchemaPrinterAbstract";

// i don't want yup as an inlined dependency
type YupSchema = Schema & {
	describe(): YupDef;
};

type _yd<t, T> = { type: t } & T;

type YupDefBase = {
	type: string;
	label?: string;
	meta?: Record<PropertyKey, any>;
	oneOf: unknown[];
	notOneOf: unknown[];
	default?: unknown;
	nullable: boolean;
	optional: boolean;
};

type YupDef =
	| _yd<"string" | "number" | "boolean" | "date", YupDefBase>
	| _yd<"array", YupDefBase & { innerType?: YupDef }>
	| _yd<"tuple", YupDefBase & { innerType?: YupDef[] }>
	| _yd<"object", YupDefBase & { fields: Record<string, YupDef> }>;

export class YupSchemaPrinter extends SchemaPrinterAbstract {
	print(schema: Schema, io: "in" | "out"): string {
		return this.main((schema as YupSchema).describe() as YupDef, io);
	}

	private main(d: YupDef, io: "in" | "out", asKey = false): string {
		let base = "";
		if (d.oneOf?.length) {
			// yup stores raw values here; only primitives map cleanly to TS literals
			base = d.oneOf
				.filter((v) => v === null || ["string", "number", "boolean"].includes(typeof v))
				.sort()
				.map((v) => this.literal(v))
				.join(" | ");
		}
		if (base === "") {
			switch (d.type) {
				case "string":
				case "number":
				case "boolean":
					base = d.type;
					break;
				case "date":
					base = "Date";
					break;
				case "array":
					base = d.innerType ? `Array<${this.main(d.innerType, io)}>` : "Array<unknown>";
					break;
				case "tuple":
					base = d.innerType
						? `[${d.innerType.map((i) => this.main(i, io)).join(", ")}]`
						: "Array<unknown>";
					break;
				case "object": {
					const entries = Object.entries(d.fields)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, f]) => `${this.key(k)}${f.optional ? "?" : ""}: ${this.main(f, io, true)}`);
					base = entries.length === 0 ? "{}" : `{ ${entries.join("; ")} }`;
					break;
				}
				default:
					base = "unknown";
			}
		}
		// the `?` on the key already implies undefined — don't duplicate it
		if (d.optional && !asKey) base += ` | undefined`;
		if (d.nullable) base += ` | null`;
		return base;
	}
}

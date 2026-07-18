import type * as TZ from "zod";

import type { Schema } from "@/schema/Schema";
import { SchemaPrinterAbstract } from "@/schema/SchemaPrinterAbstract";

type _zd<t, T extends TZ.ZodType> = { type: t } & T["def"];

type ZodDef =
	| _zd<"intersection", TZ.ZodIntersection>
	| _zd<"int", TZ.ZodType> // TZ.ZodInt is broken
	| _zd<"function", TZ.ZodFunction>
	| _zd<"custom", TZ.ZodCustom>
	| _zd<"template_literal", TZ.ZodTemplateLiteral>
	| _zd<"readonly", TZ.ZodReadonly>
	| _zd<"nan", TZ.ZodNaN>
	| _zd<"catch", TZ.ZodCatch>
	| _zd<"prefault", TZ.ZodPrefault>
	| _zd<"transform", TZ.ZodTransform>
	| _zd<"success", TZ.ZodSuccess>
	| _zd<"nonoptional", TZ.ZodNonOptional>
	| _zd<"file", TZ.ZodFile>
	| _zd<"date", TZ.ZodDate>
	| _zd<"unknown", TZ.ZodUnknown>
	| _zd<"any", TZ.ZodAny>
	| _zd<"never", TZ.ZodNever>
	| _zd<"void", TZ.ZodVoid>
	| _zd<"undefined", TZ.ZodUndefined>
	| _zd<"null", TZ.ZodNull>
	| _zd<"symbol", TZ.ZodSymbol>
	| _zd<"bigint", TZ.ZodBigInt>
	| _zd<"number", TZ.ZodNumber>
	| _zd<"string", TZ.ZodString>
	| _zd<"boolean", TZ.ZodBoolean>
	| _zd<"object", TZ.ZodObject>
	| _zd<"record", TZ.ZodRecord>
	| _zd<"array", TZ.ZodArray>
	| _zd<"tuple", TZ.ZodTuple>
	| _zd<"union", TZ.ZodUnion>
	| _zd<"map", TZ.ZodMap>
	| _zd<"set", TZ.ZodSet>
	| _zd<"enum", TZ.ZodEnum>
	| _zd<"literal", TZ.ZodLiteral>
	| _zd<"nullable", TZ.ZodNullable>
	| _zd<"optional", TZ.ZodOptional>
	| _zd<"default", TZ.ZodDefault>
	| _zd<"pipe", TZ.ZodPipe>
	| _zd<"promise", TZ.ZodPromise>
	| _zd<"lazy", TZ.ZodLazy>;

/** Node types whose def carries a single `innerType` wrapper. */
type ZodWrapped = Extract<
	ZodDef,
	{
		type:
			| "optional"
			| "nullable"
			| "default"
			| "nonoptional"
			| "readonly"
			| "catch"
			| "prefault"
			| "promise"
			| "success";
	}
>;

/** Field types that make an object key optional on the given side. */
const OPTIONAL_IN = new Set(["optional", "default", "prefault"]);

export class ZodSchemaPrinter extends SchemaPrinterAbstract {
	print(schema: Schema, io: "in" | "out"): string {
		return this.main((schema as TZ.ZodType)._zod.def as ZodDef, io);
	}

	// ---------- zod 4 ----------
	private main(def: ZodDef, io: "in" | "out", asKey = false): string {
		const inner = (d: ZodDef = def) =>
			this.main((d as ZodWrapped).innerType._zod.def as ZodDef, io);

		switch (def.type) {
			case "string":
			case "number":
			case "boolean":
			case "bigint":
			case "symbol":
			case "null":
			case "undefined":
			case "void":
			case "any":
			case "unknown":
			case "never":
				return def.type;

			case "int":
			case "nan":
				return "number";

			case "date":
				return "Date";

			case "file":
				return "File";

			case "literal":
				return def.values
					.sort()
					.map((v) => this.literal(v))
					.join(" | ");

			case "enum":
				return [...new Set(Object.values(def.entries))]
					.sort()
					.map((v) => this.literal(v))
					.join(" | ");

			case "optional":
				// the `?` on the key already implies undefined — don't duplicate it
				return asKey ? inner() : `${inner()} | undefined`;

			case "nullable":
				return `${inner()} | null`;

			case "nonoptional":
			case "readonly":
			case "catch":
				return inner();

			case "default":
			case "prefault":
				// input side accepts undefined; output side is always present
				return io === "in" && !asKey ? `${inner()} | undefined` : inner();

			case "success":
				// input is the inner type, output is always boolean
				return io === "in" ? inner() : "boolean";

			case "promise":
				return `Promise<${inner()}>`;

			case "lazy":
				return this.main(def.getter()._zod.def as ZodDef, io);

			case "array":
				return `Array<${this.main(def.element._zod.def as ZodDef, io)}>`;

			case "set":
				return `Set<${this.main(def.valueType._zod.def as ZodDef, io)}>`;

			case "map":
				return `Map<${this.main(def.keyType._zod.def as ZodDef, io)}, ${this.main(def.valueType._zod.def as ZodDef, io)}>`;

			case "record":
				return `Record<${this.main(def.keyType._zod.def as ZodDef, io)}, ${this.main(def.valueType._zod.def as ZodDef, io)}>`;

			case "tuple": {
				const items = def.items.map((i) => this.main(i._zod.def as ZodDef, io));
				if (def.rest) items.push(`...Array<${this.main(def.rest._zod.def as ZodDef, io)}>`);
				return `[${items.join(", ")}]`;
			}

			case "union":
				return def.options.map((o) => this.main(o._zod.def as ZodDef, io)).join(" | ");

			case "intersection": {
				const left = this.main(def.left._zod.def as ZodDef, io);
				const right = this.main(def.right._zod.def as ZodDef, io);
				return this.mergeObjects(left, right) ?? `${this.wrap(left)} & ${this.wrap(right)}`;
			}

			case "pipe":
				return this.main((io === "in" ? def.in : def.out)._zod.def as ZodDef, io);

			case "object": {
				const entries = Object.entries(def.shape)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([k, v]) => {
						const vd = v._zod.def as ZodDef;
						const optional = vd.type === "optional" || (io === "in" && OPTIONAL_IN.has(vd.type));
						return `${this.key(k)}${optional ? "?" : ""}: ${this.main(vd, io, optional)}`;
					});

				if (def.catchall) {
					const ct = this.main(def.catchall._zod.def as ZodDef, io);
					entries.push(`[k: string]: ${ct}`);
				}

				return entries.length === 0 ? "{}" : `{ ${entries.join("; ")} }`;
			}

			case "template_literal":
				return `\`${def.parts
					.sort()
					.map((p) =>
						p !== null && typeof p === "object" && "_zod" in p
							? `\${${this.main((p as TZ.ZodType)._zod.def as ZodDef, io)}}`
							: String(p),
					)
					.join("")}\``;

			case "function": {
				const params = def.input
					? this.main(def.input._zod.def as ZodDef, io)
					: "[...args: unknown[]]";
				const ret = def.output ? this.main(def.output._zod.def as ZodDef, io) : "unknown";
				return `(...args: ${params}) => ${ret}`;
			}

			case "custom":
			case "transform":
			default:
				return "unknown";
		}
	}

	/** Flatten `{ a } & { b }` into a single sorted object literal; null if either side isn't a plain object. */
	private mergeObjects(a: string, b: string): string | null {
		const members = (s: string): string[] | null => {
			const m = /^\{\s*([\s\S]*?)\s*\}$/.exec(s.trim());
			if (!m) return null;
			return m[1]!.length === 0 ? [] : this.split(m[1]!, ";");
		};

		const ma = members(a);
		const mb = members(b);
		if (!ma || !mb) return null;

		// later (right) side wins on key collision, matching .extend()
		const byKey = new Map<string, string>();
		for (const entry of [...ma, ...mb]) {
			const colon = this.topLevelColon(entry);
			const key = colon === -1 ? entry : entry.slice(0, colon).replace(/\?$/, "").trim();
			byKey.set(key, entry);
		}

		const sorted = [...byKey.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([, v]) => v);
		return sorted.length === 0 ? "{}" : `{ ${sorted.join("; ")} }`;
	}
}

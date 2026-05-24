import { isSomeArray } from "corpus-utils/isSomeArray";

import { BaseWriter } from "../BaseWriter/BaseWriter";
import type { BaseWriterTypes as B } from "../BaseWriter/BaseWriterTypes";
import { StringBuilder } from "../StringBuilder/StringBuilder";
import type { ClassWriterTypes as CWT } from "./ClassWriterTypes";
import type { FunctionWriterTypes as FWT } from "./FunctionWriterTypes";
import type { InterfaceWriterTypes as IWT } from "./InterfaceWriterTypes";
import type { StatementWriterTypes as SWT } from "./StatementWriterTypes";
import type { VariableWriterTypes as VWT } from "./VariableWriterTypes";

type BodyWriter = B.BodyWriter<TypescriptWriter>;

export class TypescriptWriter extends BaseWriter {
	async format() {
		const formatted = await this.formatter.format(this.read(), "typescript");
		this.finalize(formatted);
	}

	writeBody(self: TypescriptWriter, bodyWriter: BodyWriter, addIndent: number = 1): void {
		const w = new TypescriptWriter(self.indent + addIndent);
		bodyWriter(w);
		self.raw(w.read());
	}

	scope(body: BodyWriter): BodyWriter {
		return (w) => {
			w.inline("{");
			body(w);
			w.untab("}");
		};
	}

	str(s: string): string {
		return `"${s}"`;
	}

	lit(s: string): string {
		return `\`${s}\``;
	}

	tern(cond: string, t: string, f: string) {
		return `${cond} ? ${t} : ${f}`;
	}

	pair(k: string, v?: string) {
		this.line(v ? `${k}: ${v},` : `${k},`);
	}

	$class(o: CWT.Class) {
		this.variables.add(o.name);

		const genericsStr = isSomeArray(o.generics) ? `<${o.generics.join(", ")}>` : "";

		this.line(
			`${o.isExported ? `export ` : ``}${o.isAbstract ? `abstract ` : ``}class ${o.name}${genericsStr} ${o.extends ? `extends ${o.extends} ` : ``} ${o.implements ? `implements ${o.implements} ` : ``}{`,
		);

		if (o.constr) {
			this.$constructor(o.constr);
		}

		this.writeBody(this, o.body);

		this.line(`}`);
	}

	$constructor(o: CWT.Constructor) {
		this.tab(
			`constructor(${isSomeArray(o.args) ? o.args.map((a) => `${a.keyword ? `${a.keyword} ` : ``}${a.key}: ${a.type}`).join(", ") : ``}) {`,
		);

		if (!o.superArgs && !o.body) {
			this.inline("}");
			this.line("");
			return;
		}

		if (o.superArgs) {
			this.tab(`super(${o.superArgs})`, 1);
		}

		if (o.body) {
			this.writeBody(this, o.body);
		}

		this.tab("}");
		this.line("");
	}

	$methodOverload(
		method: CWT.MethodOverload1,
		overloads: CWT.MethodOverload2[],
		body: CWT.Method["body"],
	) {
		for (const o of overloads) {
			this.line(o.keyword ? `${o.keyword} ` : "");
			if (o.isAsync) this.inline("async ");
			this.inline(method.name);
			if (isSomeArray(o.generics)) this.inline(`<${o.generics.join(", ")}>`);
			this.inline(`(${isSomeArray(o.args) ? o.args.join(", ") : ""})`);
			this.inline(`: ${method.type}`);
		}

		this.inline("{");
		this.writeBody(this, body);
		this.line("};");
		this.line("");
	}

	$method(o: CWT.Method) {
		this.line(o.keyword ? `${o.keyword} ` : "");
		this.inline(
			o.isAsync ? "async " : "",
			o.name,
			isSomeArray(o.generics) ? `<${o.generics.join(", ")}>` : " ",
			`(${isSomeArray(o.args) ? o.args.join(", ") : ""})`,
			o.type ? `: ${o.type}` : " ",
			"{",
		);
		this.writeBody(this, o.body);
		this.line("};");
		this.line("");
	}

	$abstractMethod(o: CWT.AbstractMethod) {
		this.line("abstract ");
		this.inline(
			o.keyword ? `${o.keyword} ` : "",
			o.isAsync ? "async " : "",
			o.name,
			isSomeArray(o.generics) ? ` <${o.generics.join(", ")}>` : " ",
			`(${isSomeArray(o.args) ? o.args.join(", ") : ""})`,
			o.type ? `: ${o.type}` : " ",
			";",
		);
		this.line("");
	}

	$arrowMethod(o: CWT.ArrowMethod) {
		this.line(o.keyword ? `${o.keyword} ` : "");
		this.inline(
			o.name,
			o.type ? `: ${o.type}` : "",
			" = ",
			o.isAsync ? "async " : "",
			isSomeArray(o.generics) ? ` <${o.generics.join(", ")}>` : "",
			"(",
			isSomeArray(o.args) ? o.args.join(", ") : "",
			") => {",
		);
		this.writeBody(this, o.body);
		this.line("};");
		this.line("");
	}

	$member(o: CWT.Member): void {
		let value: string;
		if (typeof o.value === "string") {
			value = o.value;
		} else {
			const w = new TypescriptWriter(this.indent + 1);
			o.value(w);
			value = w.read();
		}
		this.line(
			`${o.keyword ? `${o.keyword} ` : ""}${o.name}${o.type ? `:${o.type}` : ``} = ${value};`,
		);
	}

	$functionOverload(
		method: FWT.FunctionOverload1,
		overloads: FWT.FunctionOverload2[],
		body: CWT.Method["body"],
	) {
		for (const o of overloads) {
			this.variables.add(method.name);
			this.line(`${o.isExported ? `export ` : ``}${o.isAsync ? `async ` : ``}function `);
			this.inline(method.name);
			if (isSomeArray(o.generics)) this.inline(`<${o.generics.join(", ")}>`);
			this.inline(`(${isSomeArray(o.args) ? o.args.join(", ") : ""})`);
			this.inline(`: ${method.type} `);
		}

		this.inline("{");
		this.writeBody(this, body);
		this.line("};");
		this.line("");
	}

	$function(o: FWT.Function) {
		this.variables.add(o.name);
		this.line(`${o.isExported ? `export ` : ``}${o.isAsync ? `async ` : ``}function `);
		this.inline(
			o.name,
			isSomeArray(o.generics) ? `<${o.generics.join(", ")}>` : "",
			"(",
			isSomeArray(o.args) ? o.args.join(", ") : "",
			")",
			o.type ? `: ${o.type} ` : " ",
			"{",
		);
		this.writeBody(this, o.body);
		this.line("};");
		this.line("");
	}

	$arrow(o: FWT.Arrow) {
		this.variables.add(o.name);
		this.line(`${o.keyword ?? "const"} `);
		this.inline(
			o.name,
			o.type ? `: ${o.type}` : "",
			" = ",
			o.isAsync ? "async " : "",
			isSomeArray(o.generics) ? `<${o.generics.join(", ")}>` : "",
			"(",
			isSomeArray(o.args) ? o.args.join(", ") : "",
			") => {",
		);
		this.writeBody(this, o.body);
		this.line("};");
		this.line("");
	}

	$interface(o: IWT.Interface) {
		this.interfaces.add(o.name);
		this.line(`${o.isExported ? "export " : ""}${o.variant} `);
		this.inline(
			o.name,
			isSomeArray(o.generics) ? `<${o.generics.join(", ")}> ` : " ",
			o.variant === "type" ? "= {" : o.extends ? `extends ${o.extends} {` : "{",
		);
		this.writeBody(this, o.body);
		this.line("}");
		this.line("");
	}

	$namespace(o: VWT.Namespace) {
		this.line(`${o.isExported ? "export " : ""}namespace ${o.name} {`);

		const w = new TypescriptWriter(this.indent + 1);
		o.body(w);
		this.raw(w.read());

		this.line("}");
		this.line("");
		const onlyTypes = w.variables.size === 0;
		if (onlyTypes) {
			this.interfaces.add(o.name);
		} else {
			this.variables.add(o.name);
		}
	}

	$if(...conditions: SWT.Condition[]): SWT.If {
		// oxlint-disable-next-line typescript/no-this-alias
		const writer = this;

		const makeElseChain = () => ({
			elseif: (...newConditions: SWT.Condition[]) => ({
				then: (newBody: BodyWriter) => {
					writer.line(`else if (${newConditions.join(" ")}) {`);
					writer.writeBody(writer, newBody);
					writer.line(`}`);
					return makeElseChain();
				},
			}),
			else: (finalBody: BodyWriter) => {
				writer.line(`else {`);
				writer.writeBody(writer, finalBody);
				writer.line(`}`);
			},
		});

		return {
			then: (body) => {
				writer.line(`if (${conditions.join(" ")}) {`);
				writer.writeBody(writer, body);
				writer.line(`}`);
				return makeElseChain();
			},
		};
	}

	$for(paran: SWT.ForParan[], body: BodyWriter) {
		this.line(`for (${paran.join(" ")}) {`);
		this.writeBody(this, body);
		this.line(`}`);
	}

	$switch(expr: string, ...cases: SWT.SwitchCase[]): void {
		this.line(`switch (${expr}) {`);
		for (const c of cases) {
			if (c.condition === "default") {
				this.tab(`default: {`, 1);
			} else {
				this.tab(`case ${c.condition}: {`, 1);
			}
			this.writeBody(this, c.body);
			if (c.break !== false) this.tab(`break;`, 2);
			this.tab(`}`, 1);
		}
		this.line(`}`);
	}

	$tryCatch(o: SWT.TryCatch): void {
		this.line(`try {`);
		this.writeBody(this, o.try);
		this.line(`}`);

		if (o.catch) {
			this.line(`catch (${o.catch.arg ?? `e`}) {`);
			this.writeBody(this, o.catch.body);
			this.line(`}`);
		}

		if (o.finally) {
			this.line(`finally {`);
			this.writeBody(this, o.finally);
			this.line(`}`);
		}
	}

	$return(body: BodyWriter | string): void {
		if (typeof body === "string") {
			this.line(`return${body.length === 0 ? "" : ` ${body}`};`);
			return;
		} else {
			this.line("return {");
			this.writeBody(this, body);
			this.line("};");
		}
	}

	$throw(o: SWT.Throw): void {
		this.line(`throw new ${o.errorType ?? `Error`}(${o.args});`);
	}

	$comment(o: SWT.Comment): void {
		if (typeof o === "string") {
			this.line(`// ${o}`);
			return;
		}

		switch (o.variant) {
			case "line":
				this.line(`// ${o.text}`);
				break;
			case "block":
				this.line(`/*`);
				for (const line of o.lines) this.line(` * ${line}`);
				this.line(` */`);
				break;
			case "jsdoc":
				this.line(`/**`);
				for (const line of o.lines) this.line(` * ${line}`);
				this.line(` */`);
				break;
		}
	}

	$import(o: SWT.Import) {
		const str = new StringBuilder("import ");

		if (o.def) {
			if (typeof o.def === "string") {
				str.add(o.def);
			} else {
				if (o.def.isType) str.add("type ");
				str.add(o.def.key);
				if (o.def.as) str.add(` as ${o.def.as}`);
			}
		}

		if (o.isType) str.add("type ");

		if (o.keys) {
			if (o.def) str.add(", ");
			str.add("{ ");

			for (const [i, k] of o.keys.entries()) {
				if (typeof k === "string") {
					str.add(k);
				} else {
					if (k.isType) str.add("type ");
					str.add(k.key);
					if (k.as) str.add(` as ${k.as}`);
				}
				if (i !== o.keys.length - 1) {
					str.add(", ");
				}
			}

			str.add(" }");
		}

		str.add(` from "${o.from}";`);

		this.prepend(str.read());
	}

	$export(o: SWT.Export): void {
		switch (o.variant) {
			case "type":
				this.line(`export type { ${o.keys.join(", ")} };`);
				break;
			case "object":
				this.line(`export { ${o.keys.join(", ")} };`);
				break;
			case "named":
				this.line(`export const ${o.name} = { ${o.keys.join(", ")} };`);
				break;
			case "default":
				this.line(
					`export default ${o.keys.length === 1 ? `${o.keys[0]}` : `{ ${o.keys.join(", ")} }`};`,
				);
				break;
			case "reexport":
				this.line(`export { ${o.keys.join(", ")} } from "${o.from}";`);
				break;
			case "reexportStar":
				this.line(`export * from "${o.from}";`);
				break;
		}
	}

	private resolveValue(value: string | BodyWriter) {
		if (typeof value === "string") {
			return value;
		} else {
			const w = new TypescriptWriter(this.indent + 1);
			value(w);
			return w.read();
		}
	}

	$const(o: VWT.Const): void {
		this.variables.add(o.name);
		this.line(
			`${o.isExported ? "export " : ""}const ${o.name}${o.type ? `:${o.type}` : ``} = ${this.resolveValue(o.value)};`,
		);
	}

	$var(o: VWT.Var): void {
		this.variables.add(o.name);
		this.line(
			`${o.isExported ? "export " : ""}var ${o.name}${o.type ? `:${o.type}` : ``} = ${this.resolveValue(o.value)};`,
		);
	}

	$let(o: VWT.Let): void {
		this.variables.add(o.name);
		this.line(
			`${o.isExported ? "export " : ""}let ${o.name}${o.type ? `:${o.type}` : ``}${o.value ? ` = ${this.resolveValue(o.value)}` : ``};`,
		);
	}

	$type(o: VWT.Type): this {
		this.interfaces.add(o.name);

		const values = Array.isArray(o.value) ? o.value : [o.value];
		const resolvedUnion = values.map((v) => this.resolveValue(v)).join(" | ");

		this.line(
			`${o.isExported ? "export " : ""}type ${o.name}${isSomeArray(o.generics) ? `<${o.generics.join(", ")}>` : ""} = ${resolvedUnion};`,
		);

		return this;
	}

	$assign(name: string, value: string | BodyWriter, o?: VWT.Assign) {
		this.line(name);
		if (o?.type) this.inline(`: ${o.type}`);
		this.inline(` = ${this.resolveValue(value)}`);
		if (o?.as) this.inline(` as ${o.as}`);
		if (o?.satisfies) this.inline(` satisfies ${o.satisfies}`);
	}
}

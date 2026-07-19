import type { Type } from "arktype";

import type { Schema } from "@/schema/Schema";
import { SchemaPrinterAbstract } from "@/schema/SchemaPrinterAbstract";

/** Bare identifiers that are already valid TS. */
const KEEP = new Set([
	"string",
	"number",
	"boolean",
	"bigint",
	"symbol",
	"Date",
	"File",
	"Blob",
	"FormData",
	"null",
	"undefined",
	"unknown",
	"never",
	"object",
	"Array",
	"Function",
]);

export class ArkSchemaPrinter extends SchemaPrinterAbstract {
	// .expression is already TS-ish syntax; .in/.out resolve morphs
	override print(schema: Schema, io: "in" | "out"): string {
		const t = schema as Type;
		const side = io === "in" ? t.in : t.out;
		return this.strip(side.expression);
	}

	/**
	 * Rewrite an arktype expression into valid TS: recurse through unions,
	 * intersections and bracketed groups, keeping only TS-valid constituents
	 * and dropping runtime constraints (`string <= 20`, `number % 2`, regexes).
	 */
	private strip(expr: string): string {
		const unions = this.split(expr, "|");
		if (unions.length > 1) {
			return this.sortUnion(unions.map((u) => this.strip(u))).join(" | ");
		}
		const parts = this.split(expr, "&").map((p) => this.rewriteGroup(p));
		if (parts.length === 1) return parts[0]!;
		const kept = parts.filter((s) => this.isTsToken(s));
		return kept.length > 0 ? kept.join(" & ") : "unknown";
	}

	private isTsToken(s: string): boolean {
		return (
			KEEP.has(s) || // primitives / known classes
			/^".*"$/.test(s) || // string literals
			/^-?[\d.]+n?$/.test(s) || // numeric / bigint literals
			/^(?:true|false)$/.test(s) || // boolean literals
			/^[({[]/.test(s) || // nested object / tuple / grouped
			/^Array<[\s\S]*>$/.test(s) || // arrays
			/^[A-Z][\w$]*</.test(s) // generics e.g. Record<...>
		);
	}

	/**
	 * Find the index of the bracket that closes the opening bracket at index 0
	 * of `s`, honoring quoted strings and nested brackets of the same kind.
	 * Returns -1 if `s` doesn't start with a bracket or has no matching close.
	 */
	private findMatchingClose(s: string): number {
		const open = s[0];
		if (open !== "{" && open !== "(" && open !== "[") return -1;
		const close = open === "{" ? "}" : open === "(" ? ")" : "]";
		let depth = 0;
		let quote: string | null = null;
		for (let i = 0; i < s.length; i++) {
			const c = s[i]!;
			if (quote) {
				if (c === quote && s[i - 1] !== "\\") quote = null;
				continue;
			}
			if (c === '"' || c === "'") {
				quote = c;
				continue;
			}
			if (c === open) depth++;
			else if (c === close) {
				depth--;
				if (depth === 0) return i;
			}
		}
		return -1;
	}

	/** Rewrite an arktype index-signature key like "[string]" into "[key: string]". */
	private rewriteIndexKey(rawKey: string): string {
		const m = /^\[(.+)\]$/.exec(rawKey);
		if (!m) return rawKey;
		return `[key: ${this.strip(m[1]!)}]`;
	}

	/** If `p` is a bracketed group, strip each of its comma-separated members. */
	private rewriteGroup(p: string): string {
		const closeIdx = this.findMatchingClose(p);
		if (closeIdx === -1) return p;
		const open = p[0]!;
		const close = p[closeIdx]!;
		const inner = p.slice(1, closeIdx);
		const suffix = p.slice(closeIdx + 1);
		// anything after the matching close must be only repeated array suffixes
		if (!/^(?:\[\])*$/.test(suffix)) return p;
		const members = this.split(inner, ",")
			.sort()
			.map((member) => {
				const idx = this.topLevelColon(member);
				if (idx === -1) return this.strip(member);
				const rawKey = member.slice(0, idx).trim();
				const isIndexKey = /^\[.+\]$/.test(rawKey);
				// preserve the key (and its `?`), strip only the value side
				const keyOut = isIndexKey ? this.rewriteIndexKey(rawKey) : member.slice(0, idx + 1);
				return `${keyOut}${isIndexKey ? ":" : ""} ${this.strip(member.slice(idx + 1).trim())}`;
			});
		const arrayDepth = suffix.length / 2;
		if (members.length === 0) {
			const base = `${open}${close}`;
			return arrayDepth > 0 ? this.wrapArray(base, arrayDepth) : base;
		}
		const body = members.join("; ");
		const base = open === "{" ? `{ ${body} }` : `${open}${body}${close}`;
		return arrayDepth > 0 ? this.wrapArray(base, arrayDepth) : base;
	}

	/** Wrap `base` in `Array<...>` `depth` times, instead of appending `[]` suffixes. */
	private wrapArray(base: string, depth: number): string {
		let result = base;
		for (let i = 0; i < depth; i++) {
			result = `Array<${result}>`;
		}
		return result;
	}
}

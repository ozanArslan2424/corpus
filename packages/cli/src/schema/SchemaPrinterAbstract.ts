import type { Schema } from "@/schema/Schema";

type IO = "in" | "out";

export abstract class SchemaPrinterAbstract {
	abstract print(schema: Schema, io: IO): string;

	/**
	 * Split on a depth-0 separator, respecting brackets and quotes.
	 * `<`/`>` are NOT treated as brackets — arktype constraints use them as
	 * comparison operators (`string <= 20`), which would desync the depth counter.
	 */
	protected split(expr: string, sep: "&" | "|" | "," | ";"): string[] {
		const parts: string[] = [];
		let depth = 0;
		let quote: string | null = null;
		let buf = "";

		for (let i = 0; i < expr.length; i++) {
			const c = expr[i]!;

			if (quote) {
				buf += c;
				if (c === quote && expr[i - 1] !== "\\") quote = null;
				continue;
			}
			if (c === '"' || c === "'") {
				quote = c;
				buf += c;
				continue;
			}
			if (c === "{" || c === "(" || c === "[") depth++;
			else if (c === "}" || c === ")" || c === "]") depth--;

			const isSep =
				depth === 0 &&
				c === sep &&
				(sep === "," || sep === ";" || (expr[i - 1] === " " && expr[i + 1] === " "));

			if (isSep) {
				parts.push(buf.trim());
				buf = "";
				continue;
			}
			buf += c;
		}
		parts.push(buf.trim());

		return parts.filter((p) => p.length > 0);
	}

	/** Parenthesize a union/intersection so a trailing `[]` binds to the whole thing. */
	protected wrap(s: string): string {
		return this.split(s, "|").length > 1 || this.split(s, "&").length > 1 ? `(${s})` : s;
	}

	protected key(k: string): string {
		return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
	}

	/** JSON.stringify returns the *value* undefined for undefined — normalize to TS text. */
	protected literal(v: unknown): string {
		if (v === undefined) return "undefined";
		if (typeof v === "bigint") return `${v}n`;
		return JSON.stringify(v) ?? "unknown";
	}

	protected topLevelColon(s: string): number {
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
			if (c === "{" || c === "(" || c === "[") depth++;
			else if (c === "}" || c === ")" || c === "]") depth--;
			else if (c === ":" && depth === 0) return i;
		}
		return -1;
	}

	/** Sort union members: structural types first (alphabetically), then null/undefined last. */
	protected sortUnion(members: string[]): string[] {
		const rank = (s: string) => (s === "undefined" ? 2 : s === "null" ? 1 : 0);
		return [...members].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
	}
}

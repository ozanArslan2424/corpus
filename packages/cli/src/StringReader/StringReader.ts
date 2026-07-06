export class StringReader {
	private source: string = "";

	read(source: string): this {
		this.source = source;
		return this;
	}

	readLineNumber(lineNumber: number): this {
		const lines = this.source.split("\n");
		this.source = lines[lineNumber] ?? "";
		return this;
	}

	readLines(from: number, to: number): this {
		const lines = this.source.split("\n");
		this.source = lines.slice(from, to + 1).join("\n");
		return this;
	}

	readBlock(startSearch: string): this {
		const start = this.source.indexOf(startSearch);
		if (start === -1) {
			this.source = "";
			return this;
		}

		const openChar = this.source.slice(start).match(/[({[]/);
		if (!openChar) {
			this.source = "";
			return this;
		}

		const openIndex = start + openChar.index!;
		const open = openChar[0] as "(" | "{" | "[";
		const close = { "(": ")", "{": "}", "[": "]" }[open];

		let depth = 0;
		for (let i = openIndex; i < this.source.length; i++) {
			if (this.source[i] === open) depth++;
			else if (this.source[i] === close) {
				depth--;
				if (depth === 0) {
					this.source = this.source.slice(openIndex, i + 1);
					return this;
				}
			}
		}
		this.source = "";
		return this;
	}

	// Reads the Nth top-level argument (0-indexed) from a call expression
	readArg(index: number): this {
		const open = this.source.indexOf("(");
		if (open === -1) {
			this.source = "";
			return this;
		}

		const args = this.splitTopLevelArgs(this.source.slice(open + 1, this.lastClosingParen(open)));
		this.source = args[index]?.trim() ?? "";
		return this;
	}

	// Reads a key's value from a top-level object literal (handles nested)
	readKey(key: string): this {
		const body = this.unwrapObject(this.source);
		if (body === null) {
			this.source = "";
			return this;
		}

		const pattern = new RegExp(`(?:^|[,{])\\s*${key}\\s*:`);
		const match = pattern.exec(body);
		if (!match) {
			this.source = "";
			return this;
		}

		const valueStart = match.index + match[0].length;
		this.source = this.extractValue(body, valueStart).trim();
		return this;
	}

	// Finds and reads the block assigned to a class property
	readProperty(name: string): this {
		const pattern = new RegExp(`${name}\\s*=`);
		const match = pattern.exec(this.source);
		if (!match) {
			this.source = "";
			return this;
		}
		this.source = this.source.slice(match.index + match[0].length).trim();
		return this;
	}

	collapse(): this {
		this.source = this.source.trim().replace(/\s+/g, " ");
		return this;
	}

	all(): string {
		return this.source;
	}

	between(...pairs: [string, string][]): string {
		for (const [start, end] of pairs) {
			const startIndex = this.source.indexOf(start);
			if (startIndex === -1) continue;
			const from = startIndex + start.length;
			const endIndex = this.source.indexOf(end, from);
			if (endIndex === -1) continue;
			return this.source.slice(from, endIndex).trim();
		}
		return "";
	}

	containsAnyOf(...values: string[]): boolean {
		return values.some((v) => this.source.includes(v));
	}

	containsAllOf(...values: string[]): boolean {
		return values.every((v) => this.source.includes(v));
	}

	getLineNumber(search: string): number {
		const lines = this.source.split("\n");
		return lines.findIndex((line) => line.includes(search));
	}

	// ── Private helpers ──────────────────────────────────────────────────────

	private lastClosingParen(openIndex: number): number {
		let depth = 0;
		for (let i = openIndex; i < this.source.length; i++) {
			if (this.source[i] === "(") depth++;
			else if (this.source[i] === ")") {
				depth--;
				if (depth === 0) return i;
			}
		}
		return this.source.length;
	}

	private splitTopLevelArgs(inner: string): string[] {
		const args: string[] = [];
		let depth = 0;
		let current = "";
		let inString: string | null = null;

		for (let i = 0; i < inner.length; i++) {
			const ch = inner[i];

			if (inString) {
				current += ch;
				if (ch === inString && inner[i - 1] !== "\\") inString = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === "`") {
				inString = ch;
				current += ch;
				continue;
			}
			if ("({[".includes(ch)) {
				depth++;
				current += ch;
				continue;
			}
			if (")}]".includes(ch)) {
				depth--;
				current += ch;
				continue;
			}
			if (ch === "," && depth === 0) {
				args.push(current.trim());
				current = "";
				continue;
			}
			current += ch;
		}
		if (current.trim()) args.push(current.trim());
		return args;
	}

	private unwrapObject(src: string): string | null {
		const open = src.indexOf("{");
		if (open === -1) return null;
		let depth = 0;
		for (let i = open; i < src.length; i++) {
			if (src[i] === "{") depth++;
			else if (src[i] === "}") {
				depth--;
				if (depth === 0) return src.slice(open + 1, i);
			}
		}
		return null;
	}

	private extractValue(src: string, start: number): string {
		let depth = 0;
		let inString: string | null = null;

		for (let i = start; i < src.length; i++) {
			const ch = src[i];
			if (inString) {
				if (ch === inString && src[i - 1] !== "\\") inString = null;
				continue;
			}
			if (ch === '"' || ch === "'" || ch === "`") {
				inString = ch;
				continue;
			}
			if ("({[".includes(ch)) depth++;
			else if (")}]".includes(ch)) depth--;
			else if (ch === "," && depth === 0) return src.slice(start, i);
		}
		return src.slice(start);
	}
}

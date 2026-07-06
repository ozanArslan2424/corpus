type SearchOrLine = string | number | RegExp;
type Search = string | RegExp;

export class StringReader {
	constructor(private source: string) {}

	private resolveIndex(searchOrIndex: SearchOrLine): number {
		if (typeof searchOrIndex === "number") return searchOrIndex;
		if (searchOrIndex instanceof RegExp) return this.source.search(searchOrIndex);
		return this.source.indexOf(searchOrIndex);
	}

	private resolveLineNumber(searchOrLine: SearchOrLine): number {
		if (typeof searchOrLine === "number") return searchOrLine;
		return this.getLineNumber(searchOrLine);
	}

	static contains(text: string, search: Search): boolean {
		return search instanceof RegExp ? search.test(text) : text.includes(search);
	}

	collapse(): this {
		this.source = this.source.trim().replace(/\s+/g, " ");
		return this;
	}

	toString(): string {
		return this.source;
	}

	getBetween(start: SearchOrLine, end: SearchOrLine): string {
		const fromIndex = this.resolveIndex(start);
		if (fromIndex === -1) return "";
		const from = typeof start === "string" ? fromIndex + start.length : fromIndex;
		const toIndex = this.source.indexOf(typeof end === "string" ? end : "", from);
		if (toIndex === -1) return "";
		return this.source.slice(from, typeof end === "number" ? end : toIndex).trim();
	}

	useBetween(start: SearchOrLine, end: SearchOrLine): this {
		this.source = this.getBetween(start, end);
		return this;
	}

	getFrom(startOrIndex: SearchOrLine): string {
		const index = this.resolveIndex(startOrIndex);
		if (index === -1) return "";
		const from = typeof startOrIndex === "string" ? index + startOrIndex.length : index;
		return this.source.slice(from);
	}

	useFrom(startOrIndex: SearchOrLine): this {
		this.source = this.getFrom(startOrIndex);
		return this;
	}

	getUntil(endOrIndex: SearchOrLine): string {
		const index = this.resolveIndex(endOrIndex);
		if (index === -1) return this.source;
		return this.source.slice(0, index);
	}

	useUntil(endOrIndex: SearchOrLine): this {
		this.source = this.getUntil(endOrIndex);
		return this;
	}

	getLinesBetween(startSearchOrLine: SearchOrLine, endSearchOrLine: SearchOrLine): string[] {
		const fromLine = this.resolveLineNumber(startSearchOrLine);
		const lines = this.getSplitLines();
		const startLine = lines[fromLine] ?? "";

		if (typeof endSearchOrLine === "string" && startLine.includes(endSearchOrLine)) {
			return [];
		}

		const toLine =
			typeof endSearchOrLine === "number"
				? endSearchOrLine
				: lines.findIndex(
						(line, index) => index > fromLine && StringReader.contains(line, endSearchOrLine),
					);

		return lines.slice(fromLine + 1, toLine);
	}

	useLinesBetween(startSearchOrLine: SearchOrLine, endSearchOrLine: SearchOrLine): this {
		this.source = this.getLinesBetween(startSearchOrLine, endSearchOrLine).join("\n");
		return this;
	}

	getLinesFrom(startSearchOrLine: SearchOrLine): string[] {
		const fromLine = this.resolveLineNumber(startSearchOrLine);
		return this.getSplitLines().slice(fromLine);
	}

	useLinesFrom(startSearchOrLine: SearchOrLine): this {
		this.source = this.getLinesFrom(startSearchOrLine).join("\n");
		return this;
	}

	getLinesUntil(endSearchOrLine: SearchOrLine): string[] {
		const toLine = this.resolveLineNumber(endSearchOrLine);
		return this.getSplitLines().slice(0, toLine);
	}

	useLinesUntil(endSearchOrLine: SearchOrLine): this {
		this.source = this.getLinesUntil(endSearchOrLine).join("\n");
		return this;
	}

	contains(search: Search): boolean {
		return StringReader.contains(this.source, search);
	}

	containsAnyOf(...values: string[]): boolean {
		return values.some((value) => this.source.includes(value));
	}

	containsAllOf(...searches: Search[]): boolean {
		return searches.every((search) => StringReader.contains(this.source, search));
	}

	getSplitLines(): string[] {
		return this.source.split("\n");
	}

	getLineNumber(search: Search): number {
		return this.getSplitLines().findIndex((line) => StringReader.contains(line, search));
	}

	getLineNumberAfter(afterSearchOrLine: SearchOrLine, search: Search): number {
		const afterLine = this.resolveLineNumber(afterSearchOrLine);
		return this.getSplitLines().findIndex(
			(line, index) => index > afterLine && StringReader.contains(line, search),
		);
	}

	getLine(searchOrLine: SearchOrLine): string {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		return this.getSplitLines()[lineNumber] ?? "";
	}

	useLine(searchOrLine: SearchOrLine): this {
		this.source = this.getLine(searchOrLine);
		return this;
	}

	replace(search: Search, replacement: string): this {
		this.source = this.source.replace(search, replacement);
		return this;
	}

	replaceAll(search: Search, replacement: string): this {
		this.source = this.source.replaceAll(search, replacement);
		return this;
	}

	replaceLine(searchOrLine: SearchOrLine, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = text;
		this.source = lines.join("\n");
		return this;
	}

	modifyLine(searchOrLine: SearchOrLine, modifier: (line: string) => string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = modifier(lines[lineNumber] ?? "");
		this.source = lines.join("\n");
		return this;
	}

	addLine(text: string): this {
		this.source = this.source + "\n" + text;
		return this;
	}

	addToLine(searchOrLine: SearchOrLine, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = lines[lineNumber] + text;
		this.source = lines.join("\n");
		return this;
	}

	addBelowLine(searchOrLine: SearchOrLine, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines.splice(lineNumber + 1, 0, text);
		this.source = lines.join("\n");
		return this;
	}

	addAboveLine(searchOrLine: SearchOrLine, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines.splice(lineNumber, 0, text);
		this.source = lines.join("\n");
		return this;
	}
}

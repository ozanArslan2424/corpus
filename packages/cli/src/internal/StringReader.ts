import { isObject } from "@/utils/is";

type SearchOrIndex = string | number | RegExp;
type Search = string | RegExp;

export class StringReader {
	constructor(readonly source: string) {
		this.state = source;
	}

	private state: string;

	toString(): string {
		return this.state;
	}

	// #region SEARCH
	private resolveIndex(searchOrIndex: SearchOrIndex): number {
		if (typeof searchOrIndex === "number") return searchOrIndex;
		if (searchOrIndex instanceof RegExp) return this.state.search(searchOrIndex);
		return this.state.indexOf(searchOrIndex);
	}

	private resolveLineNumber(searchOrLine: SearchOrIndex | { charIndex: number }): number {
		if (typeof searchOrLine === "number") return searchOrLine;
		const index = isObject(searchOrLine) ? searchOrLine.charIndex : this.resolveIndex(searchOrLine);
		if (index === -1) return -1;
		return this.state.slice(0, index).split("\n").length - 1;
	}

	static contains(text: string, search: Search): boolean {
		return search instanceof RegExp ? search.test(text) : text.includes(search);
	}

	contains(search: Search): boolean {
		return StringReader.contains(this.state, search);
	}

	containsAnyOf(...searches: Search[]): boolean {
		return searches.some((search) => StringReader.contains(this.state, search));
	}

	containsAllOf(...searches: Search[]): boolean {
		return searches.every((search) => StringReader.contains(this.state, search));
	}
	// #endregion

	// #region GETTERS
	getSplitLines(): string[] {
		return this.state.split("\n");
	}

	getLineNumberOfCharIndex(charIndex: number): number {
		return this.resolveLineNumber({ charIndex });
	}

	getLineNumber(search: Search): number {
		return this.getSplitLines().findIndex((line) => StringReader.contains(line, search));
	}

	getLineNumberAfter(afterSearchOrLine: SearchOrIndex, search: Search): number {
		const afterLine = this.resolveLineNumber(afterSearchOrLine);
		return this.getSplitLines().findIndex(
			(line, index) => index > afterLine && StringReader.contains(line, search),
		);
	}

	getLine(searchOrLine: SearchOrIndex): string {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		return this.getSplitLines()[lineNumber] ?? "";
	}

	getLineOfCharIndex(charIndex: number): string {
		return this.getLine(this.getLineNumberOfCharIndex(charIndex));
	}

	getCharAt(charIndex: number): string | null {
		return this.state[charIndex] ?? null;
	}

	getBetween(start: SearchOrIndex, end: SearchOrIndex): string {
		const fromIndex = this.resolveIndex(start);
		if (fromIndex === -1) return "";
		const from = typeof start === "string" ? fromIndex + start.length : fromIndex;
		const toIndex = this.state.indexOf(typeof end === "string" ? end : "", from);
		if (toIndex === -1) return "";
		return this.state.slice(from, typeof end === "number" ? end : toIndex).trim();
	}

	getFrom(startOrIndex: SearchOrIndex): string {
		const index = this.resolveIndex(startOrIndex);
		if (index === -1) return "";
		const from = typeof startOrIndex === "string" ? index + startOrIndex.length : index;
		return this.state.slice(from);
	}

	getUntil(endOrIndex: SearchOrIndex): string {
		const index = this.resolveIndex(endOrIndex);
		if (index === -1) return this.state;
		return this.state.slice(0, index);
	}

	getLinesBetween(startSearchOrLine: SearchOrIndex, endSearchOrLine: SearchOrIndex): string[] {
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

	getLinesFrom(startSearchOrLine: SearchOrIndex): string[] {
		const fromLine = this.resolveLineNumber(startSearchOrLine);
		return this.getSplitLines().slice(fromLine);
	}

	getLinesUntil(endSearchOrLine: SearchOrIndex): string[] {
		const toLine = this.resolveLineNumber(endSearchOrLine);
		return this.getSplitLines().slice(0, toLine);
	}
	// #endregion

	// #region INSTANCE
	useBetween(start: SearchOrIndex, end: SearchOrIndex): StringReader {
		return new StringReader(this.getBetween(start, end));
	}

	useFrom(startOrIndex: SearchOrIndex): StringReader {
		return new StringReader(this.getFrom(startOrIndex));
	}

	useUntil(endOrIndex: SearchOrIndex): StringReader {
		return new StringReader(this.getUntil(endOrIndex));
	}

	useLineOfCharIndex(charIndex: number): StringReader {
		return new StringReader(this.getLine(this.getLineNumberOfCharIndex(charIndex)));
	}

	useLinesBetween(startSearchOrLine: SearchOrIndex, endSearchOrLine: SearchOrIndex): StringReader {
		return new StringReader(this.getLinesBetween(startSearchOrLine, endSearchOrLine).join("\n"));
	}

	useLinesFrom(startSearchOrLine: SearchOrIndex): StringReader {
		return new StringReader(this.getLinesFrom(startSearchOrLine).join("\n"));
	}

	useLinesUntil(endSearchOrLine: SearchOrIndex): StringReader {
		return new StringReader(this.getLinesUntil(endSearchOrLine).join("\n"));
	}

	useLine(searchOrLine: SearchOrIndex): StringReader {
		return new StringReader(this.getLine(searchOrLine));
	}
	// #endregion

	// #region MUTATE
	collapse(): this {
		this.state = this.state.trim().replace(/\s+/g, " ");
		return this;
	}

	replace(search: Search, replacement: string): this {
		this.state = this.state.replace(search, replacement);
		return this;
	}

	replaceAll(search: Search, replacement: string): this {
		this.state = this.state.replaceAll(search, replacement);
		return this;
	}

	replaceLine(searchOrLine: SearchOrIndex, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = text;
		this.state = lines.join("\n");
		return this;
	}

	modifyLine(searchOrLine: SearchOrIndex, modifier: (line: string) => string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = modifier(lines[lineNumber] ?? "");
		this.state = lines.join("\n");
		return this;
	}

	addLine(text: string): this {
		this.state = this.state + "\n" + text;
		return this;
	}

	addToLine(searchOrLine: SearchOrIndex, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		lines[lineNumber] = lines[lineNumber] + text;
		this.state = lines.join("\n");
		return this;
	}

	private getIndentation(line: string): string {
		const match = line.match(/^[\t ]*/);
		return match ? match[0] : "";
	}

	private indentText(text: string, indent: string): string {
		return text
			.split("\n")
			.map((line) => (line.length > 0 ? indent + line : line))
			.join("\n");
	}

	addBelowLine(searchOrLine: SearchOrIndex, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		const indent = this.getIndentation(lines[lineNumber] ?? "");
		lines.splice(lineNumber + 1, 0, this.indentText(text, indent));
		this.state = lines.join("\n");
		return this;
	}

	addAboveLine(searchOrLine: SearchOrIndex, text: string): this {
		const lineNumber = this.resolveLineNumber(searchOrLine);
		const lines = this.getSplitLines();
		const indent = this.getIndentation(lines[lineNumber] ?? "");
		lines.splice(lineNumber, 0, this.indentText(text, indent));
		this.state = lines.join("\n");
		return this;
	}
	// #endregion
}

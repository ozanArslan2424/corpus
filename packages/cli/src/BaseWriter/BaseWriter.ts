import fs from "node:fs";

import { Formatter } from "../Formatter/Formatter";

export abstract class BaseWriter {
	constructor(indentOrFilePath?: number | string) {
		if (typeof indentOrFilePath === "string") {
			this.writeToFilePath = indentOrFilePath;
			fs.writeFileSync(indentOrFilePath, "");
		} else {
			this.indent = indentOrFilePath ?? 0;
		}
	}

	readonly indent: number = 0;
	protected readonly writeToFilePath?: string;
	protected readonly formatter = new Formatter();

	protected fileLineCount = 0;
	protected O: string[] = [];
	variables: Set<string> = new Set();
	interfaces: Set<string> = new Set();
	tabChar = "\t";

	abstract format(): Promise<void>;

	protected finalize(final: string) {
		this.O = [];
		this.O.push(final);
		if (this.writeToFilePath) {
			fs.writeFileSync(this.writeToFilePath, final);
		}
	}

	read(join: string = "\n") {
		return this.O.join(join);
	}

	raw(...strings: string[]) {
		this.O.push(...strings);
		if (this.writeToFilePath) {
			fs.appendFileSync(this.writeToFilePath, strings.join("\n") + "\n");
			this.fileLineCount += strings.length;
		}
	}

	prepend(...strings: string[]) {
		const tabs = new Array(this.indent).fill(this.tabChar).join("");
		const tabbed = strings.map((str) => `${tabs}${str}`);
		this.O.unshift(...tabbed);
		if (this.writeToFilePath) {
			const existing = fs.readFileSync(this.writeToFilePath, "utf8");
			fs.writeFileSync(this.writeToFilePath, tabbed.join("\n") + "\n" + existing);
			this.fileLineCount += tabbed.length;
		}
	}

	line(...strings: string[]) {
		const tabs = new Array(this.indent).fill(this.tabChar).join("");
		const tabbed = strings.map((str) => `${tabs}${str}`);
		this.O.push(...tabbed);
		if (this.writeToFilePath) {
			fs.appendFileSync(this.writeToFilePath, tabbed.join("\n") + "\n");
			this.fileLineCount += tabbed.length;
		}
	}

	inline(...strings: string[]) {
		if (this.O.length === 0) this.O.push("");
		this.O[this.O.length - 1] += strings.join("");
		if (this.writeToFilePath) {
			fs.writeFileSync(this.writeToFilePath, this.O.join("\n") + "\n");
		}
	}

	tab(str: string, indent: number = 1) {
		const tabs = new Array(this.indent + indent).fill(this.tabChar).join("");
		this.line(`${tabs}${str}`);
	}

	untab(str: string, indent: number = 1) {
		const tabs = new Array(Math.max(0, this.indent - indent)).fill(this.tabChar).join("");
		this.O.push(`${tabs}${str}`);
		if (this.writeToFilePath) {
			fs.appendFileSync(this.writeToFilePath, `${tabs}${str}\n`);
			this.fileLineCount += 1;
		}
	}
}

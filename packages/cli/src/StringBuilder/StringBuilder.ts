export class StringBuilder {
	constructor(init: string = "") {
		this.complete = init;
	}
	private complete: string = "";

	add(s: string): this {
		this.complete += s;
		return this;
	}

	addLine(s: string = ""): this {
		this.complete += s + "\n";
		return this;
	}

	prepend(s: string): this {
		this.complete = s + this.complete;
		return this;
	}

	replaceAll(find: string, change: string): this {
		this.complete = this.complete.replaceAll(find, change);
		return this;
	}

	replace(find: string | RegExp, change: string): this {
		this.complete = this.complete.replace(find, change);
		return this;
	}

	replaceByIndex(find: string, occurrence: number, change: string): this {
		let i = -1;
		let from = 0;
		for (let n = 0; n <= occurrence; n++) {
			i = this.complete.indexOf(find, from);
			if (i === -1) return this;
			from = i + find.length;
		}
		this.complete = this.complete.slice(0, i) + change + this.complete.slice(i + find.length);
		return this;
	}

	trim(): this {
		this.complete = this.complete.trim();
		return this;
	}

	trimEnd(): this {
		this.complete = this.complete.trimEnd();
		return this;
	}

	trimStart(): this {
		this.complete = this.complete.trimStart();
		return this;
	}

	clear(): this {
		this.complete = "";
		return this;
	}

	slice(start?: number, end?: number): this {
		this.complete = this.complete.slice(start, end);
		return this;
	}

	includes(s: string): boolean {
		return this.complete.includes(s);
	}

	startsWith(s: string): boolean {
		return this.complete.startsWith(s);
	}

	endsWith(s: string): boolean {
		return this.complete.endsWith(s);
	}

	get length(): number {
		return this.complete.length;
	}

	get isEmpty(): boolean {
		return this.complete.length === 0;
	}

	read(): string {
		return this.complete;
	}

	toString(): string {
		return this.complete;
	}
}

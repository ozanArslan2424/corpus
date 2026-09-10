export class StringBuilder {
	private complete: string = "";
	private lineCount: number = 0;
	get currentLine(): number {
		return this.lineCount;
	}

	inline(s: string): this {
		this.complete += s;
		return this;
	}

	line(input: number): (s: string) => this;
	line(input: string): this;
	line(input: string | number): this | ((s: string) => this) {
		return typeof input === "number"
			? (s: string) => this.push("\t".repeat(input) + s)
			: this.push(input);
	}

	get tab(): this {
		this.push("\t");
		return this;
	}

	private push(s: string): this {
		if (this.complete.length === 0) {
			this.complete += s;
		} else {
			this.complete += "\n" + s;
			this.lineCount++;
		}
		return this;
	}

	prepend(s: string): this {
		this.complete = s + "\n" + this.complete;
		this.lineCount++;
		return this;
	}

	clear(): this {
		this.complete = "";
		this.lineCount = 0;
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

	slice(start?: number, end?: number): this {
		this.complete = this.complete.slice(start, end);
		return this;
	}

	get length(): number {
		return this.complete.length;
	}

	get isEmpty(): boolean {
		return this.complete.length === 0;
	}

	toString(): string {
		return this.complete;
	}
}

import fs from "node:fs";
import path from "node:path";

export class Walker {
	private ignore: Set<string> = new Set();
	private extensions: string[];
	private ignoreExtensions: string[];

	constructor(extensions: string[], ignoreExtensions: string[], ignore?: Set<string>) {
		this.extensions = extensions;
		this.ignoreExtensions = ignoreExtensions;
		if (ignore) this.ignore = ignore;
	}

	walk(dir: string, out: string[]): void {
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return;
		}
		for (const name of entries) {
			if (this.ignore.has(name)) continue;
			const full = path.join(dir, name);
			let st: ReturnType<typeof fs.statSync>;
			try {
				st = fs.statSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) {
				this.walk(full, out);
				continue;
			}
			if (
				st.isFile() &&
				this.extensions.some((ext) => name.endsWith(ext)) &&
				!this.ignoreExtensions.some((ext) => name.endsWith(ext))
			) {
				out.push(full);
			}
		}
	}
}

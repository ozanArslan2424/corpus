import { CookiesAbstract } from "@/internal/modules/Cookies/CookiesAbstract";

import type { CookieOptions } from "@/internal/types/CookieOptions";

export class CookiesUsingMap extends CookiesAbstract {
	private map = new Map<string, CookieOptions>();

	toSetCookieHeaders(): Array<string> {
		const headers: Array<string> = [];
		for (const opts of this.map.values()) {
			headers.push(this.createHeader(opts));
		}
		return headers;
	}

	set(opts: CookieOptions): void {
		this.map.set(opts.name, opts);
	}

	get(name: string): string | null {
		return this.map.get(name)?.value ?? null;
	}

	has(name: string): boolean {
		return this.map.has(name);
	}

	delete(opts: Pick<CookieOptions, "name" | "path" | "domain">): void {
		this.set({
			name: opts.name,
			value: "",
			expires: new Date(0),
			path: opts?.path || "/",
			domain: opts?.domain,
		});
	}

	entries(): IterableIterator<[string, string]> {
		const entries = this.map.entries();

		const generator = function* (): IterableIterator<[string, string]> {
			for (const [name, options] of entries) {
				yield [name, options.value];
			}
		};

		return generator();
	}

	values(): Array<string> {
		return Array.from(this.map.values()).map((opt) => opt.value);
	}

	keys(): Array<string> {
		return Array.from(this.map.keys());
	}
}

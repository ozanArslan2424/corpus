import { CookiesAbstract } from "@/internal/modules/Cookies/CookiesAbstract";

import type { CookieOptions } from "@/internal/types/CookieOptions";

export class CookiesUsingBun extends CookiesAbstract {
	private map = new Bun.CookieMap();

	toSetCookieHeaders(): Array<string> {
		return this.map.toSetCookieHeaders();
	}

	set(opts: CookieOptions): void {
		this.map.set(opts.name, opts.value, opts);
	}

	get(name: string): string | null {
		return this.map.get(name);
	}

	has(name: string): boolean {
		return this.map.has(name);
	}

	delete(opts: Pick<CookieOptions, "name" | "path" | "domain">): void {
		this.map.delete(opts);
	}

	entries(): IterableIterator<[string, string]> {
		return this.map.entries();
	}

	values(): Array<string> {
		return Array.from(this.map.values());
	}

	keys(): Array<string> {
		return Array.from(this.map.keys());
	}
}

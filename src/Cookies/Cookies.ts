import { CookiesAbstract } from "@/Cookies/CookiesAbstract";
import { CookiesUsingBun } from "@/Cookies/CookiesUsingBun";
import type { CookieOptions } from "@/Cookies/types/CookieOptions";
import type { CookiesInit } from "@/Cookies/types/CookiesInit";

export class Cookies extends CookiesAbstract {
	// TODO: node support
	private instance: CookiesAbstract;

	constructor(init?: CookiesInit) {
		super();
		this.instance = new CookiesUsingBun(init);
	}

	set(opts: CookieOptions): void {
		return this.instance.set(opts);
	}

	setMany(optsArr: Array<CookieOptions>): void {
		return this.instance.setMany(optsArr);
	}

	get(name: string): string | null {
		return this.instance.get(name);
	}

	has(name: string): boolean {
		return this.instance.has(name);
	}

	get count(): number {
		return this.instance.count;
	}

	delete(name: string): void {
		return this.instance.delete(name);
	}

	entries(): IterableIterator<[string, string]> {
		return this.instance.entries();
	}

	values(): Array<string> {
		return this.instance.values();
	}

	keys(): Array<string> {
		return this.instance.keys();
	}

	toSetCookieHeaders(): Array<string> {
		return this.instance.toSetCookieHeaders();
	}
}

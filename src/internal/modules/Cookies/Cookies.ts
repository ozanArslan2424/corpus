import { CookiesAbstract } from "@/internal/modules/Cookies/CookiesAbstract";
import { RuntimeOptions } from "@/internal/enums/RuntimeOptions";
import { getRuntime } from "@/internal/global/getRuntime";
import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";
import { CookiesUsingBun } from "@/internal/modules/Cookies/CookiesUsingBun";
import { CookiesUsingMap } from "@/internal/modules/Cookies/CookiesUsingMap";
import type { CookieOptions } from "@/internal/types/CookieOptions";
import type { CookiesInit } from "@/internal/types/CookiesInit";

/** Simple cookie map/jar to collect and manipulate cookies. */

export class Cookies extends CookiesAbstract implements CookiesInterface {
	private instance: CookiesInterface;

	private getInstance(): CookiesInterface {
		const runtime = getRuntime();

		switch (runtime) {
			case RuntimeOptions.bun:
				return new CookiesUsingBun();

			case RuntimeOptions.node:
			default:
				return new CookiesUsingMap();
		}
	}

	constructor(init?: CookiesInit) {
		super();

		this.instance = this.getInstance();

		if (init) {
			this.applyInit(init);
		}
	}

	toSetCookieHeaders(): Array<string> {
		return this.instance.toSetCookieHeaders();
	}

	set(opts: CookieOptions): void {
		return this.instance.set(opts);
	}

	get(name: string): string | null {
		return this.instance.get(name);
	}

	has(name: string): boolean {
		return this.instance.has(name);
	}

	delete(opts: Pick<CookieOptions, "name" | "path" | "domain">): void {
		return this.instance.delete(opts);
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
}

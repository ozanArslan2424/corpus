import type { AppsRegistry } from "@/AppsRegistry";
import type { ParsersRegistry } from "@/ParsersRegistry";
import { assertDefined } from "@/utils/assert";

import pkg from "../../package.json";

interface GlobalRegistry {
	// key: Type;
	initialized: boolean;
	apps: AppsRegistry;
	parsers: ParsersRegistry;
}

const namespace = (key: string) => `${pkg.name}:${key}`;

const GLOBAL_SYMBOLS = {
	initialized: Symbol.for(namespace("initialized")),
	apps: Symbol.for(namespace("apps")),
	parsers: Symbol.for(namespace("parsers")),
} as const satisfies Record<keyof GlobalRegistry, symbol>;

class Globals {
	private static readonly store = globalThis as Record<symbol, unknown>;

	static getSymbol<K extends keyof GlobalRegistry>(key: K): (typeof GLOBAL_SYMBOLS)[K] {
		return GLOBAL_SYMBOLS[key];
	}

	static create<K extends keyof GlobalRegistry>(
		key: K,
		init: () => GlobalRegistry[K],
	): GlobalRegistry[K] {
		const symbolKey = GLOBAL_SYMBOLS[key];
		if (!(symbolKey in this.store)) this.store[symbolKey] = init();
		return this.store[symbolKey] as GlobalRegistry[K];
	}

	static get<K extends keyof GlobalRegistry>(key: K): GlobalRegistry[K] {
		const symbolKey = GLOBAL_SYMBOLS[key];
		const value = this.store[symbolKey];
		assertDefined(value, `Global "${String(key)}" was accessed before being created`);
		return value as GlobalRegistry[K];
	}

	static set<K extends keyof GlobalRegistry>(key: K, value: GlobalRegistry[K]): void {
		const symbolKey = GLOBAL_SYMBOLS[key];
		this.store[symbolKey] = value;
	}

	static has<K extends keyof GlobalRegistry>(key: K): boolean {
		const symbolKey = GLOBAL_SYMBOLS[key];
		return symbolKey in this.store;
	}

	static delete<K extends keyof GlobalRegistry>(key: K): void {
		const symbolKey = GLOBAL_SYMBOLS[key];
		delete this.store[symbolKey];
	}
}

export type { GlobalRegistry };
export { Globals, GLOBAL_SYMBOLS };

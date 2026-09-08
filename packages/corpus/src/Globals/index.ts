/**
 * Typed process-wide state, stored on `globalThis` under package-namespaced
 * symbols.
 *
 * Two things in the framework must be singletons regardless of how many times
 * the module is evaluated: the {@link AppsRegistry} that {@link getNearestApp}
 * resolves against, and the {@link ParsersRegistry} that every route reads while
 * compiling. Module-level variables cannot guarantee that — a duplicated
 * dependency, a re-import under a different resolution, or a test runner
 * reloading modules each produces a second copy, and two apps registries means
 * routes registering onto an app that is never served.
 *
 * The keys are `Symbol.for("@ozanarslan/corpus:<key>")`, so they are shared
 * across every copy of the package in the process and cannot collide with
 * another library's globals.
 *
 * @module Globals
 */

import type { AppsRegistry } from "@/AppsRegistry";
import type { ParsersRegistry } from "@/ParsersRegistry";
import { assertDefined } from "@/utils/assert";

import pkg from "../../package.json";

/**
 * What lives in the global store, and the type of each entry. Adding a key here
 * requires a matching entry in {@link GLOBAL_SYMBOLS}, which the `satisfies`
 * clause enforces.
 */
interface GlobalRegistry {
	// key: Type;
	/** Whether one-time framework setup has run. */
	initialized: boolean;
	/** The shared {@link AppsRegistry} — every {@link App} constructed in this process. */
	apps: AppsRegistry;
	/** The shared {@link ParsersRegistry} — the parsers routes resolve at compile time. */
	parsers: ParsersRegistry;
}

/**
 * Prefixes a key with the package name, so global symbols cannot collide with
 * another library's.
 *
 * @param key - The unprefixed key.
 * @returns The namespaced string the symbol is registered under.
 */
const namespace = (key: string) => `${pkg.name}:${key}`;

/**
 * The symbol for each {@link GlobalRegistry} entry.
 *
 * Registered through `Symbol.for`, so every copy of the package in the process
 * resolves to the same symbol and therefore to the same stored value.
 */
const GLOBAL_SYMBOLS = {
	initialized: Symbol.for(namespace("initialized")),
	apps: Symbol.for(namespace("apps")),
	parsers: Symbol.for(namespace("parsers")),
} as const satisfies Record<keyof GlobalRegistry, symbol>;

/**
 * Typed accessor for the global store.
 *
 * Keys are constrained to {@link GlobalRegistry}, so every read and write is
 * checked against the type declared for that entry.
 */
class Globals {
	/** The backing store: `globalThis`, typed for symbol access. */
	private static readonly store = globalThis as Record<symbol, unknown>;

	/**
	 * Returns the symbol an entry is stored under.
	 *
	 * Useful for inspecting or clearing global state directly — in a test that
	 * needs a clean process, for instance.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 * @returns Its symbol from {@link GLOBAL_SYMBOLS}.
	 */
	static getSymbol<K extends keyof GlobalRegistry>(key: K): (typeof GLOBAL_SYMBOLS)[K] {
		return GLOBAL_SYMBOLS[key];
	}

	/**
	 * Reads an entry, creating it on first access.
	 *
	 * The initialiser runs only when the entry is absent, which is what makes this
	 * safe to call from anywhere: the first caller creates the value and every
	 * later one gets that same instance. This is how
	 * {@link getOrInitAppsRegistry} and {@link getOrInitParsersRegistry} work.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 * @param init - Builds the initial value. Not called if the entry exists.
	 * @returns The stored value.
	 */
	static create<K extends keyof GlobalRegistry>(
		key: K,
		init: () => GlobalRegistry[K],
	): GlobalRegistry[K] {
		const symbolKey = GLOBAL_SYMBOLS[key];
		if (!(symbolKey in this.store)) this.store[symbolKey] = init();
		return this.store[symbolKey] as GlobalRegistry[K];
	}

	/**
	 * Reads an entry that is expected to exist.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 * @returns The stored value.
	 * @throws {@link Error} when the entry has not been created. Use
	 * {@link Globals.create} when the caller may be the first.
	 */
	static get<K extends keyof GlobalRegistry>(key: K): GlobalRegistry[K] {
		const symbolKey = GLOBAL_SYMBOLS[key];
		const value = this.store[symbolKey];
		assertDefined(value, `Global "${String(key)}" was accessed before being created`);
		return value as GlobalRegistry[K];
	}

	/**
	 * Writes an entry, replacing any existing value.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 * @param value - The value to store.
	 */
	static set<K extends keyof GlobalRegistry>(key: K, value: GlobalRegistry[K]): void {
		const symbolKey = GLOBAL_SYMBOLS[key];
		this.store[symbolKey] = value;
	}

	/**
	 * Reports whether an entry has been created, without creating it or throwing.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 * @returns `true` when the entry exists.
	 */
	static has<K extends keyof GlobalRegistry>(key: K): boolean {
		const symbolKey = GLOBAL_SYMBOLS[key];
		return symbolKey in this.store;
	}

	/**
	 * Removes an entry, so the next {@link Globals.create} rebuilds it from
	 * scratch. Mainly useful for resetting state between tests.
	 *
	 * @param key - The {@link GlobalRegistry} entry.
	 */
	static delete<K extends keyof GlobalRegistry>(key: K): void {
		const symbolKey = GLOBAL_SYMBOLS[key];
		delete this.store[symbolKey];
	}
}

export { type GlobalRegistry, Globals, GLOBAL_SYMBOLS };

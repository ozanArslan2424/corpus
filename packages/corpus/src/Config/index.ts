/**
 * Typed access to environment variables and the current runtime environment.
 *
 * {@link Config} is a static façade over `process.env` — nothing is cached, so a
 * read always reflects the current value. Beyond convenience, it is what the
 * framework itself consults for environment-dependent behaviour: {@link App}
 * checks {@link Config.nodeEnv} before exiting the process on
 * {@link App.close}.
 *
 * Declare your variables on {@link Env} in your own code to get autocompletion
 * and a checked key for every lookup.
 *
 * ```ts
 * const port = Config.get("PORT", { parser: Number, fallback: 3000 });
 * const secret = Config.require("JWT_SECRET");
 * ```
 *
 * @module Config
 */

import type { OrString } from "@/utils/lexical";
import { isUndefined } from "@/utils/maybe";

/**
 * Declaration target for an application's environment variables.
 *
 * Empty by design. Augment it from your own code and every key you add becomes a
 * suggested {@link EnvKey}:
 *
 * ```ts
 * declare module "corpus" {
 *   interface Env {
 *     DATABASE_URL: string;
 *     JWT_SECRET: string;
 *   }
 * }
 * ```
 */
interface Env {}

/**
 * The value of `NODE_ENV`. The three known environments are suggested, but any
 * string is accepted — {@link OrString} keeps the literals as hints rather than
 * as a closed set.
 */
type NodeEnv = OrString<"development" | "production" | "test">;

/**
 * A variable name accepted by the {@link Config} lookups. Keys declared on
 * {@link Env} are suggested; any other string still resolves.
 */
type EnvKey = OrString<keyof Env>;

/**
 * Static accessor for environment variables.
 *
 * Every read goes straight to `process.env`, so a variable set after startup —
 * by a test, or by {@link Config.set} — is visible immediately.
 *
 * The three lookups differ in how they treat a missing value:
 * {@link Config.get} returns `undefined` or a fallback, {@link Config.require}
 * throws, and {@link Config.has} only reports presence.
 */
class Config {
	/**
	 * The live `process.env` object.
	 *
	 * @returns The environment, unwrapped. Reading it directly bypasses the
	 * parsing and fallback handling of {@link Config.get}.
	 */
	static get env(): NodeJS.ProcessEnv {
		return process.env;
	}

	/**
	 * The current environment name.
	 *
	 * @returns The value of `NODE_ENV`, or `"development"` when it is unset — an
	 * unconfigured process is treated as a development one.
	 */
	static get nodeEnv(): NodeEnv {
		return this.env.NODE_ENV ?? "development";
	}

	/**
	 * @returns `true` when {@link Config.nodeEnv} is `"production"`.
	 */
	static get isProd(): boolean {
		return this.nodeEnv === "production";
	}

	/**
	 * @returns `true` when {@link Config.nodeEnv} is `"development"`, including
	 * when `NODE_ENV` is unset.
	 */
	static get isDev(): boolean {
		return this.nodeEnv === "development";
	}

	/**
	 * @returns `true` when {@link Config.nodeEnv} is `"test"`. {@link App.close}
	 * checks this to avoid exiting the process out from under a test runner.
	 */
	static get isTest(): boolean {
		return this.nodeEnv === "test";
	}

	/**
	 * Reports whether a variable is set, without reading its value.
	 *
	 * @param key - The variable name to check.
	 * @returns `true` when the variable is defined. An empty string counts as
	 * defined.
	 */
	static has(key: EnvKey): boolean {
		return !isUndefined(this.env[key]);
	}

	/**
	 * Reads a variable as a raw string.
	 *
	 * @param key - The variable name to read.
	 * @returns The value, or `undefined` when unset.
	 */
	static get(key: EnvKey): string | undefined;
	/**
	 * Reads a variable with a guaranteed result, since a fallback covers the unset
	 * case.
	 *
	 * @param key - The variable name to read.
	 * @param opts - Lookup options.
	 * @param opts.parser - Converts the raw string into the value you want. Not
	 * applied to the fallback, which is used as given.
	 * @param opts.fallback - Returned when the variable is unset.
	 * @returns The parsed value, or the fallback.
	 */
	static get<T = string>(key: EnvKey, opts: { parser?: (raw: string) => T; fallback: T }): T;
	/**
	 * Reads and converts a variable with no fallback.
	 *
	 * @param key - The variable name to read.
	 * @param opts - Lookup options.
	 * @param opts.parser - Converts the raw string into the value you want.
	 * @param opts.fallback - Returned when the variable is unset.
	 * @returns The parsed value, or `undefined` when the variable is unset.
	 */
	static get<T = string>(
		key: EnvKey,
		opts: { parser: (raw: string) => T; fallback?: T },
	): T | undefined;
	static get<T = string>(
		key: EnvKey,
		opts?: { parser?: (raw: string) => T; fallback?: T },
	): T | undefined {
		const value = this.env[key];
		if (!isUndefined(value)) {
			return opts?.parser ? opts.parser(value) : (value as T);
		}
		if (opts && "fallback" in opts) {
			return opts.fallback;
		}
		return undefined;
	}

	/**
	 * Reads a variable that the application cannot run without.
	 *
	 * @param key - The variable name to read.
	 * @returns The raw value.
	 * @throws {@link Error} when the variable is unset.
	 */
	static require(key: EnvKey): string;
	/**
	 * Reads and converts a variable that the application cannot run without.
	 *
	 * @param key - The variable name to read.
	 * @param parser - Converts the raw string into the value you want.
	 * @returns The parsed value.
	 * @throws {@link Error} when the variable is unset. The parser is never called
	 * in that case, so it can assume a real value.
	 */
	static require<T = string>(key: EnvKey, parser: (raw: string) => T): T;
	static require<T = string>(key: EnvKey, parser?: (raw: string) => T): T | string {
		const value = parser ? this.get(key, { parser }) : this.get(key);
		if (isUndefined(value)) {
			throw new Error(`Required environment variable "${key}" is not set`);
		}
		return value;
	}

	/**
	 * Writes a variable into the environment, stringifying the value the way the
	 * environment stores everything.
	 *
	 * Mutates the real `process.env`, so the change is visible to every reader in
	 * the process, not only to {@link Config}.
	 *
	 * @param key - The variable name to write.
	 * @param value - The value to store; numbers and booleans are converted to
	 * their string form.
	 */
	static set(key: string, value: string | number | boolean): void {
		this.env[key] = String(value);
	}
}

export { Config };
export type { Env };

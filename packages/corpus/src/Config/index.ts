import type { OrString } from "@/utils/lexical";
import { isUndefined } from "@/utils/maybe";

interface Env {}

type NodeEnv = OrString<"development" | "production" | "test">;

type EnvKey = OrString<keyof Env>;

class Config {
	static get env(): NodeJS.ProcessEnv {
		return process.env;
	}

	static get nodeEnv(): NodeEnv {
		return this.env.NODE_ENV ?? "development";
	}

	static get isProd(): boolean {
		return this.nodeEnv === "production";
	}

	static get isDev(): boolean {
		return this.nodeEnv === "development";
	}

	static get isTest(): boolean {
		return this.nodeEnv === "test";
	}

	static has(key: EnvKey): boolean {
		return !isUndefined(this.env[key]);
	}

	static get(key: EnvKey): string | undefined;
	static get<T = string>(key: EnvKey, opts: { parser?: (raw: string) => T; fallback: T }): T;
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

	static require(key: EnvKey): string;
	static require<T = string>(key: EnvKey, parser: (raw: string) => T): T;
	static require<T = string>(key: EnvKey, parser?: (raw: string) => T): T | string {
		const value = parser ? this.get(key, { parser }) : this.get(key);

		if (isUndefined(value)) {
			throw new Error(`Required environment variable "${key}" is not set`);
		}

		return value;
	}

	static set(key: string, value: string | number | boolean): void {
		this.env[key] = String(value);
	}
}

export type { Env };
export { Config };

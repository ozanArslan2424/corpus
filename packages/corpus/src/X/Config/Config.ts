import { isEmpty, type Func, type OrString } from "@/utils";

import type { Env } from "@/index";

type NodeEnv = OrString<"development" | "production" | "test">;
type EnvKey = OrString<keyof Env>;

export class Config {
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
		return !isEmpty(this.env[key]);
	}

	static get(key: EnvKey): string | undefined;
	static get<T = string>(key: EnvKey, opts: { parser?: Func<[raw: string], T>; fallback: T }): T;
	static get<T = string>(
		key: EnvKey,
		opts: { parser: Func<[raw: string], T>; fallback?: T },
	): T | undefined;
	static get<T = string>(
		key: EnvKey,
		opts?: { parser?: Func<[raw: string], T>; fallback?: T },
	): T | undefined {
		const value = this.env[key];

		if (!isEmpty(value)) {
			return opts?.parser ? opts.parser(value) : (value as T);
		}

		if (opts && "fallback" in opts) {
			return opts.fallback;
		}

		return undefined;
	}

	static require<T = string>(key: EnvKey, parser?: Func<[string], T>): T {
		const value = this.env[key];

		if (isEmpty(value)) {
			throw new Error(`Required environment variable "${key}" is not set`);
		}

		return parser ? parser(value) : (value as T);
	}

	static set(key: string, value: string | number | boolean): void {
		this.env[key] = String(value);
	}
}

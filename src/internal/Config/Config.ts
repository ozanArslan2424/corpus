import type { ConfigEnvKey } from "@/internal/Config/ConfigEnvKey";
import type { ConfigValueParser } from "@/internal/Config/ConfigValueParser";
import { getRuntime } from "@/internal/runtime/getRuntime";
import { RuntimeOptions } from "@/internal/runtime/RuntimeOptions";
import "dotenv/config";

export class Config {
	static get env() {
		const runtime = getRuntime();

		switch (runtime) {
			case RuntimeOptions.bun:
				return Bun.env;
			case RuntimeOptions.node:
			default:
				return process.env;
		}
	}

	static get<T = string>(
		key: ConfigEnvKey,
		opts?: { parser?: ConfigValueParser<T>; fallback?: T },
	): T {
		const value = this.env[key];
		if (value !== undefined && value !== "") {
			return opts?.parser ? opts?.parser(value) : (value as T);
		} else if (opts?.fallback !== undefined) {
			return opts?.fallback;
		} else {
			throw new Error(`${key} doesn't exist in env`);
		}
	}

	static set(key: string, value: string) {
		this.env[key] = value;
	}
}

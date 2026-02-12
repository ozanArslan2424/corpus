import type { ConfigValueParser } from "@/internal/types/ConfigValueParser";
import type { ConfigEnvKey } from "@/internal/types/ConfigEnvKey";
import { getRuntime } from "@/internal/global/getRuntime";
import { RuntimeOptions } from "@/internal/enums/RuntimeOptions";

export class Config {
	static get env() {
		return getRuntime() === RuntimeOptions.bun
			? Bun.env
			: typeof process !== "undefined" && process?.env
				? process.env
				: {};
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

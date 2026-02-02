import type { __Coreumum_ConfigEnvKey } from "@/Config/__Coreum_ConfigEnvKey";
import type { __Coreumum_ConfigValueParser } from "@/Config/__Coreum_ConfigValueParser";
import { __Coreum_getRuntime } from "@/runtime/__Coreum_getRuntime";
import { __Coreum_RuntimeOptions } from "@/runtime/__Coreum_RuntimeOptions";
import "dotenv/config";

export class __Coreum_Config {
	static get env() {
		const runtime = __Coreum_getRuntime();

		switch (runtime) {
			case __Coreum_RuntimeOptions.bun:
				return Bun.env;
			case __Coreum_RuntimeOptions.node:
			default:
				return process.env;
		}
	}

	static get<T = string>(
		key: __Coreumum_ConfigEnvKey,
		opts?: { parser?: __Coreumum_ConfigValueParser<T>; fallback?: T },
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

import { RuntimeOptions } from "@/Config/enums/RuntimeOptions";
import type { ConfigEnvKey } from "@/Config/types/ConfigEnvKey";
import type { ConfigValueParser } from "@/Config/types/ConfigValueParser";
import { strIsDefined } from "@/utils/strIsDefined";
import type { OrString } from "@/utils/types/OrString";
import path from "path";

export class Config {
	static get runtime(): string {
		if (typeof Bun !== "undefined") {
			return RuntimeOptions.bun;
		}

		if (typeof process !== "undefined" && process?.env) {
			return RuntimeOptions.node;
		}

		console.warn(
			"⚠️ Runtime isn't Bun or NodeJS. Features may not be available. App might not start.",
		);
		return "unknown";
	}

	static get nodeEnv(): OrString<"development" | "production" | "test"> {
		return this.env.NODE_ENV ?? "development";
	}

	static get env(): NodeJS.ProcessEnv {
		switch (this.runtime) {
			case RuntimeOptions.bun:
				return Bun.env;
			case RuntimeOptions.node:
				return process.env;
			default:
				console.warn(
					"⚠️ process.env wasn't available. Your environment variables are in memory.",
				);
				return {};
		}
	}

	static cwd() {
		return process.cwd();
	}

	static resolvePath(...paths: string[]) {
		return path.resolve(...paths);
	}

	static get<T = string>(
		key: ConfigEnvKey,
		opts?: { parser?: ConfigValueParser<T>; fallback?: T },
	): T {
		const value = this.env[key];

		if (strIsDefined(value)) {
			return opts?.parser ? opts?.parser(value) : (value as T);
		}

		if (opts?.fallback !== undefined) {
			return opts?.fallback;
		}

		console.error(`${key} doesn't exist in env`);
		return undefined as T;
	}

	static set(key: string, value: string | number | boolean): void {
		if (typeof value === "number") {
			this.env[key] = value.toString();
			return;
		}

		if (typeof value === "boolean") {
			this.env[key] = value ? "true" : "false";
			return;
		}

		this.env[key] = value;
	}
}

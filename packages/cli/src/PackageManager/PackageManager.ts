import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "path";

import { logFatal } from "@/utils/logger";

import type { Config } from "../config";
import type { PackageInterface } from "../Package/PackageInterface";

export class PackageManager {
	constructor(
		private readonly config: Config,
		private readonly cwd?: string,
	) {}

	get manager(): string {
		return this.config.packageManager ?? this.content.packageManager?.split("@")?.[0] ?? "bun";
	}

	get path(): string {
		// the user's project package.json
		if (this.cwd) {
			return join(this.cwd, "package.json");
		}
		// the package's own package.json (for version, deps, etc.)
		return new URL("../package.json", import.meta.url).pathname;
	}

	get content() {
		return JSON.parse(readFileSync(this.path, "utf-8"));
	}

	get name(): string {
		return this.content.name ?? "app";
	}

	get exists(): boolean {
		return existsSync(this.path);
	}

	get version(): string {
		return this.content.version ?? "0.0.0";
	}

	get dependencies(): Record<string, string> {
		return this.content.dependencies ?? {};
	}

	get devDependencies(): Record<string, string> {
		return this.content.devDependencies ?? {};
	}

	async install() {
		return Bun.$`${this.manager} install`;
	}

	async run(cmd: string) {
		return Bun.$`${this.manager} run ${cmd}`;
	}

	async add(...pkgs: PackageInterface[]) {
		const cmd = this.manager === "npm" ? "install" : "add";
		const fmt = (p: PackageInterface) => `${p.name}${p.version ? `@${p.version}` : ""}`;

		const dev = pkgs.filter((p) => p.dev);
		const prod = pkgs.filter((p) => !p.dev);

		if (dev.length) await Bun.$`${this.manager} ${cmd} -D ${dev.map(fmt)}`;
		if (prod.length) await Bun.$`${this.manager} ${cmd} ${prod.map(fmt)}`;
	}

	async remove(name: string) {
		return Bun.$`${this.manager} ${this.manager === "npm" ? "uninstall" : "remove"} ${name}`;
	}

	create() {
		if (!this.cwd) {
			logFatal("You are trying to create a package.json inside the cli dist.");
		}
		const content = {
			name: this.cwd.split("/").at(-1) ?? "app",
			private: true,
			scripts: {
				build: "bun run build.ts",
				dev: "bun run src/main.ts",
				start: "bun run dist/index.js",
			},
			dependencies: {},
			devDependencies: {},
		};

		writeFileSync(this.path, JSON.stringify(content), "utf-8");
		console.log("📄 Created package.json.");
	}
}

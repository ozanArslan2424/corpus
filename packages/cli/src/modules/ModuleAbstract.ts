import fs from "fs";
import { createInterface } from "node:readline/promises";
import path from "path";
import { parseArgs } from "util";

import { logger, setLogger } from "@ozanarslan/utils/logger";
import { isUndefined, type Nullable } from "@ozanarslan/utils/maybe";

import type { Config } from "@/config/Config";
import { getConfig } from "@/config/getConfig";
import { resolveCwdPath } from "@/functions/resolveCwdPath";

export interface ModuleInterface {
	help: string[];
	keys: string[];
	main(): void | Promise<void>;
	run(): Promise<void>;
	stop(): Promise<void>;
}

export interface Options {
	dry: boolean;
	force: boolean;
	id: Nullable<string>;
	stdout: boolean;
	noOpen: boolean;
}

export interface Flags {
	name: string | null;
	empty: boolean;
}

export abstract class ModuleAbstract implements ModuleInterface {
	constructor() {
		this.config = getConfig();
	}

	protected config: Config;
	protected flags: Flags = {
		name: null,
		empty: false,
	};

	abstract readonly keys: string[];
	abstract get help(): string[];
	abstract main(): void | Promise<void>;

	protected passedKey: string = "";
	private messages: string[] = [];
	protected addMessage(msg: string) {
		this.messages.push(msg);
	}

	async run() {
		const shutdown = async (code: number, err?: unknown) => {
			await this.stop();
			if (err) logger.error(String(err));
			process.exit(code);
		};

		process.once("SIGINT", () => void shutdown(130));
		process.once("SIGTERM", () => void shutdown(143));
		process.once("uncaughtException", (err) => void shutdown(1, err));
		process.once("unhandledRejection", (err) => void shutdown(1, err));

		this.parseFlags();

		logger.info(`Running: ${this.passedKey}`);

		if (this.config.silent) setLogger(logger.noop);

		await this.main();
	}

	private stopped = false;
	async stop() {
		logger.info(`Stopping: ${this.passedKey}`);

		if (this.stopped) return;
		this.stopped = true;
		for (const msg of this.messages) logger.warn(msg);
	}

	protected printHelp(exitCode: number): never {
		process.stdout.write(this.help.join("\n"));
		process.exit(exitCode);
	}

	private parseFlags() {
		this.passedKey = process.argv.slice(2)[0] ?? "";

		const { values, positionals } = parseArgs({
			args: process.argv.slice(3),
			options: {
				help: { type: "boolean", short: "h" },
				main: { type: "string", short: "m" },
				silent: { type: "boolean", short: "s", default: false },
				name: { type: "string", short: "n" },
				output: { type: "string", short: "o" },
				empty: { type: "boolean", short: "e", default: false },
			},
			allowPositionals: true,
		});

		if (values.help) {
			this.printHelp(0);
		}

		this.flags.name = values.name ?? positionals[0] ?? null;
		this.flags.empty = values.empty;
		if (!isUndefined(values.silent)) this.config.silent = values.silent;
		if (!isUndefined(values.main)) this.config.main = values.main;
		if (!isUndefined(values.output)) this.config.output = values.output;
	}

	protected async promptConfirm(question: string): Promise<boolean> {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const answer = await rl.question(question + " (y/n) ");
		rl.close();
		const confirmed = /^y(es)?$/i.test(answer.trim());
		if (!confirmed) process.exit(0);
		return confirmed;
	}

	protected readFile(segments: string[]): string {
		try {
			return fs.readFileSync(resolveCwdPath(...segments), "utf8");
		} catch {
			return "";
		}
	}

	protected checkFileExists(segments: string[]): boolean {
		return fs.existsSync(resolveCwdPath(...segments));
	}

	protected writeFile(content: string, segments: string[]): void {
		return this.writeToAbsolutePath(content, resolveCwdPath(...segments));
	}

	protected writeToAbsolutePath(content: string, absPath: string) {
		const exists = fs.existsSync(absPath);
		const cleanPath = absPath.replace(process.cwd(), "");

		if (exists) {
			logger.warn(`NOT WRITTEN: File exists at ${cleanPath}.`);
			return;
		}

		fs.mkdirSync(path.dirname(absPath), { recursive: true });
		fs.writeFileSync(absPath, content);
		logger.info(`Writing file: ${cleanPath}`);
	}
}

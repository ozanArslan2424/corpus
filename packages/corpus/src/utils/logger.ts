export type Logger = {
	log(...args: any[]): void;
	bold(...args: any[]): void;
	log(...args: any[]): void;
	info(...args: any[]): void;
	success(...args: any[]): void;
	error(...args: any[]): void;
	debug(...args: any[]): void;
	warn(...args: any[]): void;
	step(...args: any[]): void;
	section(title: string): void;
	noop: Logger;
};

const col = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	gray: "\x1b[90m",
	bold: "\x1b[1m",
	magenta: "\x1b[35m",
	blue: "\x1b[34m",
} as const;

export function strColor(color: keyof typeof col, str: string): string {
	return col[color] + str + col.reset;
}

function makeLogger(): Logger {
	const log = {} as Logger;

	log.log = (...a: any[]) => console.log(...a);
	log.bold = (...a: any[]) => console.log(col.bold, ...a, col.reset);
	log.info = (...a: any[]) => console.log(`${col.cyan}i${col.reset}`, ...a);
	log.success = (...a: any[]) => console.log(`${col.green}✓${col.reset}`, ...a);
	log.error = (...a: any[]) => console.error(`${col.red}✗${col.reset}`, ...a);
	log.debug = (...a: any[]) => console.log(`${col.gray}·${col.reset}`, ...a);
	log.warn = (...a: any[]) => console.warn(`${col.yellow}⚠${col.reset}`, ...a);
	log.step = (...a: any[]) => console.log(`${col.magenta}>${col.reset}`, ...a);
	log.section = (title: string) => {
		const line = "─".repeat(58);
		console.log(`\n${col.bold}${col.blue}${line}${col.reset}`);
		console.log(`${col.bold}${col.blue}  ${title}${col.reset}`);
		console.log(`${col.bold}${col.blue}${line}${col.reset}`);
	};

	log.noop = {
		bold() {},
		log() {},
		info() {},
		success() {},
		error() {},
		debug() {},
		warn() {},
		step() {},
		section(_) {},
	} as Logger;
	return log;
}

export const logger = makeLogger();

export function logFatal(...args: any[]): never {
	if (process.env.NODE_ENV === "test") {
		throw new Error(JSON.stringify(args));
	} else {
		logger.error(...args);
		process.exit(1);
	}
}

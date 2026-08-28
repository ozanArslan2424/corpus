// oxlint-disable typescript/no-explicit-any
export type Logger = {
	log(...args: any[]): void;
	bold(...args: any[]): void;
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
	const logger = {} as Logger;
	logger.log = (...a: any[]) => console.log(...a);
	logger.bold = (...a: any[]) => console.log(col.bold, ...a, col.reset);
	logger.info = (...a: any[]) => console.log(`${col.cyan}i${col.reset}`, ...a);
	logger.success = (...a: any[]) => console.log(`${col.green}✓${col.reset}`, ...a);
	logger.error = (...a: any[]) => console.error(`${col.red}✗${col.reset}`, ...a);
	logger.debug = (...a: any[]) => console.log(`${col.gray}·${col.reset}`, ...a);
	logger.warn = (...a: any[]) => console.warn(`${col.yellow}⚠${col.reset}`, ...a);
	logger.step = (...a: any[]) => console.log(`${col.magenta}>${col.reset}`, ...a);
	logger.section = (title: string) => {
		const line = "─".repeat(58);
		console.log(`\n${col.bold}${col.blue}${line}${col.reset}`);
		console.log(`${col.bold}${col.blue}  ${title}${col.reset}`);
		console.log(`${col.bold}${col.blue}${line}${col.reset}`);
	};
	logger.noop = {
		bold() {},
		log() {},
		info() {},
		success() {},
		debug() {},
		warn() {},
		step() {},
		// oxlint-disable-next-line no-unused-vars
		section(_) {},
		// do not suppress errors
		error: (...a: any[]) => console.error(`${col.red}✗${col.reset}`, ...a),
	} as Logger;
	return logger;
}

const defaultLogger = makeLogger();

// mutable holder — `logger` proxies to whatever is currently active
let active: Logger = defaultLogger;

export const logger: Logger = new Proxy({} as Logger, {
	get(_target, prop: keyof Logger) {
		return active[prop];
	},
});

export function setLogger(custom: Logger): void {
	active = custom;
}

export function resetLogger(): void {
	active = defaultLogger;
}

export function logFatal(...args: any[]): never {
	if (process.env.NODE_ENV === "test") {
		throw new Error(JSON.stringify(args));
	} else {
		logger.error(...args);
		process.exit(1);
	}
}

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

export function makeLogger(): Logger {
	const logger = {} as Logger;
	logger.log = (...a: any[]) => console.log(...a);
	logger.bold = (...a: any[]) => console.log(col.bold, ...a, col.reset);
	logger.info = (...a: any[]) => console.log(strColor("cyan", "i"), ...a);
	logger.success = (...a: any[]) => console.log(strColor("green", "✓"), ...a);
	logger.error = (...a: any[]) => console.error(strColor("red", "✗"), ...a);
	logger.debug = (...a: any[]) => console.log(strColor("gray", "·"), ...a);
	logger.warn = (...a: any[]) => console.warn(strColor("yellow", "⚠"), ...a);
	logger.step = (...a: any[]) => console.log(strColor("magenta", ">"), ...a);

	return logger;
}

export function makeNoopLogger(): Logger {
	return {
		bold() {},
		log() {},
		info() {},
		success() {},
		debug() {},
		warn() {},
		step() {},
		error() {},
	};
}

// mutable holder — `logger` proxies to whatever is currently active
let active: Logger = makeLogger();

export const logger: Logger = new Proxy({} as Logger, {
	get(_target, prop: keyof Logger) {
		return active[prop];
	},
});

export function setLogger(custom: Logger): void {
	active = custom;
}

export function setLoggerNoop(): void {
	active = makeNoopLogger();
}

export function resetLogger(): void {
	active = makeLogger();
}

export function logFatal(...args: any[]): never {
	if (process.env.NODE_ENV === "test") {
		throw new Error(JSON.stringify(args));
	} else {
		logger.error(...args);
		process.exit(1);
	}
}

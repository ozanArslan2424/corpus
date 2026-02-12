import type { LoggerInterface } from "@/internal/modules/Logger/LoggerInterface";

export abstract class LoggerAbstract implements LoggerInterface {
	key: string;

	constructor(key: string) {
		this.key = key;
	}

	error: (...args: any[]) => void = (...args) => {
		console.error(`\x1b[31m[${this.key}]\x1b[0m`, ...args); // Red
	};

	warn: (...args: any[]) => void = (...args) => {
		console.warn(`\x1b[33m[${this.key}]\x1b[0m`, ...args); // Yellow
	};

	log: (...args: any[]) => void = (...args) => {
		console.log(`\x1b[36m[${this.key}]\x1b[0m`, ...args); // Cyan
	};

	debug: (...args: any[]) => void = (...args) => {
		console.debug(`\x1b[32m[${this.key}]\x1b[0m`, ...args); // Green
	};
}

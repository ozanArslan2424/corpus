import { logger } from "./logger";

export class Timer {
	private t: number = 0;

	ms() {
		const elapsed = performance.now() - this.t;
		return elapsed >= 1000
			? `\x1b[31m${(elapsed / 1000).toFixed(2)}s\x1b[0m`
			: `\x1b[33m${elapsed.toFixed(2)}ms\x1b[0m`;
	}

	step(label: string) {
		logger.step(`${label} ${this.ms()}`);
		this.t = performance.now();
	}

	done(label: string) {
		logger.success(`${label} ${this.ms()}`);
	}
}

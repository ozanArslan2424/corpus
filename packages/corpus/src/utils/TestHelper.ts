import { logger as alwaysLog, type Logger } from "./logger";

export class TestHelper {
	constructor(silent: boolean) {
		this.log = silent ? alwaysLog.noop : alwaysLog;
	}

	public readonly log: Logger;

	passed = 0;
	failed = 0;
	failures: string[] = [];

	logResults(title: string) {
		if (this.failed > 0) {
			alwaysLog.success(`${this.passed} passed`);
			alwaysLog.error(`${this.failed} failed`);
			alwaysLog.bold("Failures:");
			for (const f of this.failures) alwaysLog.step(f);
		} else {
			alwaysLog.success(`All ${this.passed} assertions passed 🔥 (${title})`);
		}
	}

	stringify(input: any) {
		if (Array.isArray(input)) {
			// oxlint-disable-next-line typescript/require-array-sort-compare
			return JSON.stringify(input.sort());
		} else {
			return JSON.stringify(input);
		}
	}

	expect(label: string, actual: any) {
		const pass = (display: string) => {
			this.log.success(`${label} → ${display}`);
			this.passed++;
		};
		const fail = (msg: string) => {
			this.log.error(msg);
			this.failures.push(msg);
			this.failed++;
		};

		const stringify = (input: any) => this.stringify(input);

		return {
			toBe(expected: any) {
				if (actual === expected) pass(stringify(actual));
				else fail(`${label}: expected ${stringify(expected)}, got ${stringify(actual)}`);
			},
			toEqual(expected: any) {
				if (stringify(actual) === stringify(expected)) pass(stringify(actual));
				else fail(`${label}: expected ${stringify(expected)}, got ${stringify(actual)}`);
			},
			toContain(expected: string) {
				const str = typeof actual === "string" ? actual : stringify(actual);
				if (str.includes(expected)) pass(`contains "${expected}"`);
				else fail(`${label}: expected to contain "${expected}", got "${str}"`);
			},
			toBeGreaterThan(n: number) {
				if (actual > n) pass(`${actual} > ${n}`);
				else fail(`${label}: expected ${actual} > ${n}`);
			},
			toBeLessThan(n: number) {
				if (actual < n) pass(`${actual} < ${n}`);
				else fail(`${label}: expected ${actual} < ${n}`);
			},
			toMatchStatus(expected: number) {
				if (actual === expected) pass(`HTTP ${actual}`);
				else fail(`${label}: expected status ${expected}, got ${actual}`);
			},
			toHaveProperty(key: string, value?: any) {
				if (!(key in Object(actual))) {
					fail(`${label}: expected property "${key}" to exist on ${stringify(actual)}`);
				} else if (value !== undefined && actual[key] !== value) {
					fail(`${label}: expected .${key} = ${stringify(value)}, got ${stringify(actual[key])}`);
				} else {
					pass(value !== undefined ? `.${key} = ${stringify(value)}` : `.${key} exists`);
				}
			},
		};
	}
}

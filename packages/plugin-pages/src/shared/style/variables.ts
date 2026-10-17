export interface Variables {}

const variables = new Map<string, string>();

/** Generic so the caller's literal type survives; the returned value is what the augmentation keys off. */
export function defineVariables<const T extends Record<string, string | number>>(record: T): T {
	for (const [key, value] of Object.entries(record)) {
		variables.set(key, String(value));
	}
	return record;
}

export function variableProxy(): Variables {
	return Object.fromEntries(
		[...variables.keys()].map((key) => [key, `var(--${key})`]),
	) as unknown as Variables;
}

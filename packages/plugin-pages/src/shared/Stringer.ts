/** A string that is already safe for its context and is inserted as-is by any tag. */
export abstract class Stringer {
	constructor(readonly value: string) {}
	toString() {
		return this.value;
	}
}

export type Tag<T extends Stringer> = (
	strings: TemplateStringsArray,
	...values: Array<unknown>
) => T;

/** Builds a template tag that produces `Kind` and runs plain interpolated values through `escape`. */
export function tag<T extends Stringer>(
	Kind: new (value: string) => T,
	escape: (value: string) => string,
): Tag<T> {
	function stringify(value: unknown): string {
		if (value == null || value === false) return "";
		if (value instanceof Stringer) return value.value;
		if (Array.isArray(value)) return value.map(stringify).join("");
		return escape(String(value));
	}

	return (strings, ...values) => {
		let out = strings[0]!;
		for (let i = 0; i < values.length; i++) out += stringify(values[i]) + strings[i + 1];
		return new Kind(out);
	};
}

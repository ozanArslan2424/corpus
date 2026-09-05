interface ParserBaseInterface<T> {
	parse(input: T): Record<string, unknown>;
}

/**
 * Bracket segments that parse as an integer become array indices, so
 * `a[999999999]=1` would otherwise produce a billion-length array whose
 * JSON serialization is gigabytes of `null,` — a 15-byte body that OOMs
 * the process. Past this bound the segment stays a string key, and the
 * container is built as a plain object instead of an array.
 */
const ARRAY_INDEX_LIMIT = 1_000;

abstract class ParserBase<T> implements ParserBaseInterface<T> {
	abstract parse(input: T): Record<string, unknown>;

	protected newContainer(current: unknown): Record<string | number, unknown> {
		return current as Record<string | number, unknown>;
	}

	protected parseKey(key: string): (string | number)[] {
		// split "a[0].b[1][c]" into ["a", 0, "b", 1, "c"]
		// "next" is used to assigned to correct index
		const parts: (string | number)[] = [];
		for (const part of key.split(/[.[\]]+/).filter(Boolean)) {
			if (!/^\d+$/.test(part)) {
				parts.push(part);
				continue;
			}
			const index = parseInt(part);
			parts.push(index <= ARRAY_INDEX_LIMIT ? index : part);
		}
		return parts;
	}

	protected tryParseJSON(value: string): unknown {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
}

export type { ParserBaseInterface };
export { ParserBase };

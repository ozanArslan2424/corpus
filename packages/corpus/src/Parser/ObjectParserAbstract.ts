import type { ObjectParserInterface } from "@/Registry/types";

export abstract class ObjectParserAbstract<T> implements ObjectParserInterface<T> {
	// ABSTRACT

	abstract parse(input: T): Record<string, unknown>;

	// PROTECTED

	protected newContainer(current: unknown): Record<string | number, unknown> {
		return current as Record<string | number, unknown>;
	}

	protected parseKey(key: string): (string | number)[] {
		// split "a[0].b[1][c]" into ["a", 0, "b", 1, "c"]
		// "next" is used to assigned to correct index
		const parts: (string | number)[] = [];
		for (const part of key.split(/[.[\]]+/).filter(Boolean)) {
			// if (this.isDangerousKey(part)) {
			// 	throw new CError(`Dangerous key detected: "${part}"`, Status.BAD_REQUEST);
			// }
			parts.push(/^\d+$/.test(part) ? parseInt(part) : part);
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

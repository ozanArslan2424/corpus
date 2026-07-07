import { ObjectParserAbstract } from "@/Parsers/ObjectParserAbstract";

export class SearchParamsParser extends ObjectParserAbstract<URLSearchParams> {
	parse(searchParams: URLSearchParams): Record<string, unknown> {
		const result = this.newSafeObject();

		searchParams.forEach((entry, key) => {
			const parts = this.parseKey(key);
			const value = this.tryParseJSON(entry);
			this.setDeep(result, parts, value);
		});

		return result;
	}

	// same as formdata but good to keep separate
	private setDeep(result: Record<string, unknown>, parts: (string | number)[], value: unknown) {
		let current = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]!;
			const next = parts[i + 1];
			// just for readability, current can be used directly as well
			const container = this.newContainer(current);

			// each part needs an entry
			// container[part] is undefined so we assign it as inner container
			if (container[part] === undefined) {
				const isIndexAssigned = typeof next === "number";
				container[part] = isIndexAssigned ? [] : this.newSafeObject();
			}

			// if container[part] defined, it is a value assigned directly
			(current as unknown) = container[part];
		}

		const last = parts[parts.length - 1]!;
		const container = this.newContainer(current);
		const existing = container[last];

		if (existing === undefined) {
			// first write at this slot
			container[last] = value;
		} else if (Array.isArray(existing)) {
			// slot already holds an array, append
			container[last] = [...existing, value];
		} else {
			// slot holds a single value, promote to array
			container[last] = [existing, value];
		}
	}
}

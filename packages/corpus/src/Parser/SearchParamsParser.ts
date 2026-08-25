import { createSafeObject } from "@ozanarslan/utils";

import { ObjectParserAbstract } from "@/Parser/ObjectParserAbstract";

export class SearchParamsParser extends ObjectParserAbstract<URLSearchParams> {
	parse(searchParams: URLSearchParams): Record<string, unknown> {
		const result = createSafeObject();

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
			const isIndexAssigned = typeof next === "number";
			if (container[part] === undefined) {
				container[part] = isIndexAssigned ? [] : createSafeObject();
			} else if (typeof container[part] !== "object" || container[part] === null) {
				// scalar already sitting where we need to descend: replace it
				container[part] = isIndexAssigned ? [] : createSafeObject();
			}
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

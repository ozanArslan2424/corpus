import { createSafeObject } from "@ozanarslan/utils";

import { ObjectParserAbstract } from "@/Parser/ObjectParserAbstract";

export class FormDataParser extends ObjectParserAbstract<FormData> {
	parse(formData: FormData): Record<string, unknown> {
		const result = createSafeObject();

		formData.forEach((entry, key) => {
			const parts = this.parseKey(key);
			const value = entry instanceof File ? entry : this.tryParseJSON(entry);
			this.setDeep(result, parts, value);
		});

		return result;
	}

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
				container[part] = isIndexAssigned ? [] : createSafeObject();
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

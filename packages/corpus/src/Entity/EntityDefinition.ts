import type { Schema } from "@/utils/Schema";

import type { EntityJsonSchema } from "@/Entity/EntityJsonSchema";

export interface EntityDefinition<T extends Schema = Schema> {
	name: string;
	schema: T;
	jsonSchema?: EntityJsonSchema;
	disableParsing?: boolean;
}

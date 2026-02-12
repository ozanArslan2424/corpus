import type { SchemaType } from "@/internal/types/SchemaType";

export interface ParserInterface {
	parse<O>(data: unknown, schema: SchemaType<O>, errorMessage: string): O;
	toJsonSchema(schema: SchemaType): Record<string, unknown>;
}

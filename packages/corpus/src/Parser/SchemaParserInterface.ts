import type { SchemaValidator } from "@/utils/Schema";
import type { UnknownObject } from "@/utils/UnknownObject";

export interface SchemaParserInterface {
	parse<T = UnknownObject>(label: string, data: unknown, validate?: SchemaValidator<T>): Promise<T>;
	parseSync<T = UnknownObject>(label: string, data: unknown, validate?: SchemaValidator<T>): T;
}

import type { UnknownObject } from "@/utils/UnknownObject";

export interface ObjectParserInterface<T> {
	parse(input: T): UnknownObject;
}

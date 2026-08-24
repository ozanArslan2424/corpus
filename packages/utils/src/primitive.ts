import { isBoolean } from "@/booleans";
import { isString } from "@/lexical";
import { isNumber, isBigint } from "@/numerical";

export type Primitive = string | number | boolean | bigint;

export function isPrimitive(input: unknown): input is Primitive {
	return isString(input) || isNumber(input) || isBoolean(input) || isBigint(input);
}

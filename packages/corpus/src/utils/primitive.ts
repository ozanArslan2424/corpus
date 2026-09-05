import { isBoolean } from "@/utils/boolean";
import { isString } from "@/utils/lexical";
import { isNumber, isBigint } from "@/utils/numerical";

export type Primitive = string | number | boolean | bigint;

export function isPrimitive(input: unknown): input is Primitive {
	return isString(input) || isNumber(input) || isBoolean(input) || isBigint(input);
}

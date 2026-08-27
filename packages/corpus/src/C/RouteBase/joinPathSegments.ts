import { isEmpty, isNumber } from "@/utils";

export function joinPathSegments<P extends string>(
	...segments: Array<string | undefined | number>
): P {
	const joined = segments
		.map((segment) => (isNumber(segment) ? `${segment}` : segment))
		.filter((segment): segment is string => !isEmpty(segment))
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter((segment) => segment.length > 0)
		.join("/");

	return `/${joined}` as P;
}

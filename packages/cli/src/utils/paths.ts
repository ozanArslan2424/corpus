import path from "path";

import { isNumber } from "@/utils/is";
import { strNotEmpty } from "@/utils/strings";
import type { Maybe } from "@/utils/types";

export function joinPathSegments(...segments: Maybe<string | number>[]): string {
	return segments
		.map((segment) => (isNumber(segment) ? segment.toString() : segment))
		.filter((segment): segment is string => strNotEmpty(segment))
		.flatMap((segment) => segment.split("/"))
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter((segment) => segment.length > 0)
		.join("/");
}

export function resolveCwdPath(...segments: Maybe<string | number>[]): string {
	const joined = joinPathSegments(...segments);
	const resolved = path.resolve(process.cwd(), joined);
	return resolved;
}

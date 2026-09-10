import path from "path";

import { isEmpty, type Maybe } from "@/utils/is";

export function resolveCwdPath(...segments: Maybe<string | number>[]): string {
	const joined = segments
		.map((segment) => (typeof segment === "number" ? segment.toString() : segment))
		.filter((segment): segment is string => !isEmpty(segment))
		.flatMap((segment) => segment.split("/"))
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter((segment) => segment.length > 0)
		.join("/");
	const resolved = path.resolve(process.cwd(), joined);
	return resolved;
}

import path from "path";

import type { Maybe } from "@ozanarslan/utils/maybe";

import { joinPathSegments } from "@/functions/joinPathSegments";

export function resolveCwdPath(...segments: Maybe<string | number>[]): string {
	const joined = joinPathSegments(...segments);
	const resolved = path.resolve(process.cwd(), joined);
	return resolved;
}

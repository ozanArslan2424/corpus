import type { CacheControlDefinition } from "@/C/Headers/Headers.types";

export function createCacheControlHeader(opts: CacheControlDefinition): string {
	if (opts.noStore) return "no-store";
	if (opts.noCache) return "no-cache";

	const parts: string[] = [];

	if (opts.public) parts.push("public");
	if (opts.maxAge !== undefined) parts.push(`max-age=${opts.maxAge}`);
	if (opts.immutable) parts.push("immutable");

	return parts.join(", ");
}

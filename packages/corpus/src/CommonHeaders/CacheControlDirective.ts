import type { CHeaders } from "@/CHeaders/CHeaders";
import type { CacheControlDirectiveInterface } from "@/CommonHeaders/CacheControlDirectiveInterface";
import { CommonHeaders } from "@/CommonHeaders/CommonHeaders";

export class CacheControlDirective implements CacheControlDirectiveInterface {
	constructor(private readonly opts: CacheControlDirectiveInterface | "no-cache") {
		if (typeof opts !== "string") {
			Object.assign(this, opts);
		}
	}

	public?: boolean;
	maxAge?: number;
	immutable?: boolean;
	noCache?: boolean;
	noStore?: boolean;

	static createHeaderString(opts: CacheControlDirectiveInterface | "no-cache"): string {
		if (opts === "no-cache") return "no-cache";

		if (opts.noStore) return "no-store";
		if (opts.noCache) return "no-cache";

		const parts: string[] = [];

		if (opts.public) parts.push("public");
		if (opts.maxAge !== undefined) parts.push(`max-age=${opts.maxAge}`);
		if (opts.immutable) parts.push("immutable");

		return parts.join(", ");
	}

	toHeaderString(): string {
		return CacheControlDirective.createHeaderString(this.opts);
	}

	static applyHeader(
		headers: CHeaders,
		opts: CacheControlDirectiveInterface | "no-cache",
	): CHeaders {
		headers.set(CommonHeaders.CacheControl, CacheControlDirective.createHeaderString(opts));
		return headers;
	}

	applyHeader(headers: CHeaders): CHeaders {
		return CacheControlDirective.applyHeader(headers, this.opts);
	}
}

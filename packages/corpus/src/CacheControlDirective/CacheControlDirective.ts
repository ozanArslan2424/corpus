import { HeaderKey } from "@/enums/HeaderKey";

export class CacheControlDirective {
	constructor(opts: CacheControlDirective) {
		Object.assign(this, opts);
	}

	public?: boolean;
	maxAge?: number;
	immutable?: boolean;
	noCache?: boolean;
	noStore?: boolean;

	static createHeaderString(opts: CacheControlDirective): string {
		if (opts.noStore) return "no-store";
		if (opts.noCache) return "no-cache";

		const parts: string[] = [];

		if (opts.public) parts.push("public");
		if (opts.maxAge !== undefined) parts.push(`max-age=${opts.maxAge}`);
		if (opts.immutable) parts.push("immutable");

		return parts.join(", ");
	}

	static applyHeader(headers: Headers, opts: CacheControlDirective): Headers {
		headers.set(HeaderKey.CacheControl, CacheControlDirective.createHeaderString(opts));
		return headers;
	}
}

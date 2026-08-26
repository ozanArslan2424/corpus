import { HeaderKey } from "@/C/HeaderKey";

export class ContentDispositionDirective {
	constructor(opts: ContentDispositionDirective) {
		Object.assign(this, opts);
	}

	disposition!: "attachment" | "inline";
	filename?: string;

	static createHeaderString(opts: ContentDispositionDirective): string {
		if (opts.filename === undefined) return opts.disposition;
		return `${opts.disposition}; filename="${opts.filename}"`;
	}

	static applyHeader(headers: Headers, opts: ContentDispositionDirective): Headers {
		headers.set(HeaderKey.ContentDisposition, ContentDispositionDirective.createHeaderString(opts));
		return headers;
	}
}

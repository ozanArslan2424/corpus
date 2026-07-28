import { HeaderKey } from "@/enums/HeaderKey";

export class ContentDispositionDirective {
	constructor(opts: ContentDispositionDirective) {
		Object.assign(this, opts);
	}

	type!: "attachment" | "inline";
	filename?: string;

	static createHeaderString(opts: ContentDispositionDirective): string {
		if (opts.filename === undefined) return opts.type;
		return `${opts.type}; filename="${opts.filename}"`;
	}

	static applyHeader(headers: Headers, opts: ContentDispositionDirective): Headers {
		headers.set(HeaderKey.ContentDisposition, ContentDispositionDirective.createHeaderString(opts));
		return headers;
	}
}

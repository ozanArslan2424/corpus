export interface CacheControlDefinition {
	public?: boolean;
	maxAge?: number;
	immutable?: boolean;
	noCache?: boolean;
	noStore?: boolean;
}

export interface ContentDispositionDefinition {
	disposition: "attachment" | "inline";
	filename?: string;
}

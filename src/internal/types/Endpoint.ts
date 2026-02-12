export type Endpoint<E extends string> = E extends `${string}?${string}`
	? `Error: Path contains optional parameter '?': ${E}`
	: E;

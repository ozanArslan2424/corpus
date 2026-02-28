export type CookieOptions = {
	name: string;
	value: string;
	domain?: string;
	/** Defaults to '/'. */
	path?: string;
	expires?: number | Date;
	secure?: boolean;
	/** Defaults to `lax`. */
	sameSite?: "strict" | "lax" | "none";
	httpOnly?: boolean;
	partitioned?: boolean;
	maxAge?: number;
};

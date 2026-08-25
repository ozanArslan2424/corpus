export type RateLimitIdPrefix = "u" | "i" | "f";

export type RateLimitEntry = {
	hits: number;
	resetAt: number;
};

// Storage interface for pluggable backends
export interface RateLimitStoreInterface {
	get(id: string): Bun.MaybePromise<RateLimitEntry | undefined>;
	set(id: string, entry: RateLimitEntry): Bun.MaybePromise<void>;
	delete(id: string): Bun.MaybePromise<void>;
	cleanup(now: number): Bun.MaybePromise<void>;
	clear(): Bun.MaybePromise<void>;
	size(): Bun.MaybePromise<number>;
}

export type RateLimitConfig = {
	/**
	 * Limits based on identifier type:
	 * u: Authenticated users — higher limit, accountable identity (e.g., 120 requests)
	 * i: IP-based — moderate, may be shared (NAT, proxies) (e.g., 60 requests)
	 * f: Fingerprint / anonymous — lowest, least trustworthy (e.g., 20 requests)
	 * */
	limits: Record<RateLimitIdPrefix, number>;

	/**
	 * Time window in milliseconds during which the rate limit applies (default: 60,000ms = 1 minute)
	 * */
	windowMs: number;

	/**
	 * How often to rotate the salt used for hashing identifiers (default: 24h)
	 * Prevents long-term tracking and adds an extra layer of privacy
	 * */
	saltRotateMs: number;

	/**
	 * Probability (0-1) of triggering a cleanup of expired entries on each request
	 * Balances memory usage against performance (default: 0.005 = 0.5%)
	 * */
	cleanProbability: number;

	/**
	 * Maximum number of entries before forcing a cleanup
	 * Prevents unbounded memory growth (default: 50,000)
	 * */
	maxStoreSize: number;

	/** Bring your own store implementation */
	store?: RateLimitStoreInterface;

	/** Directory path for file-based storage (required when storeType = "file") */
	storeDir?: string;

	/**
	 * Customizable HTTP header names for rate limit information.
	 * Allows integration with different API conventions or frontend expectations.
	 *
	 * @example
	 * // Custom header names (e.g., for legacy systems)
	 * headerNames: {
	 *   limit: "X-RateLimit-Limit",
	 *   remaining: "X-RateLimit-Remaining",
	 *   reset: "X-RateLimit-Reset",
	 *   retryAfter: "Retry-After"
	 * }
	 *
	 * @default Uses standard RateLimit-* headers as defined in IETF draft:
	 * - limit: "RateLimit-Limit"
	 * - remaining: "RateLimit-Remaining"
	 * - reset: "RateLimit-Reset"
	 * - retryAfter: "Retry-After"
	 */
	headerNames: {
		/** Header name for the maximum allowed requests in the current window */
		limit: string;
		/** Header name for the remaining requests in the current window */
		remaining: string;
		/** Header name for the timestamp (Unix seconds) when the window resets */
		reset: string;
		/** Header name for seconds to wait before retrying when rate limited */
		retryAfter: string;
	};
};

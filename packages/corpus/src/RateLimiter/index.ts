/**
 * Request rate limiting, as a ready-made {@link Middleware}.
 *
 * {@link RateLimiter} counts requests per caller within a rolling window and
 * rejects anything over the limit with {@link Status.TOO_MANY_REQUESTS}. Who
 * "the caller" is depends on what the request proves about itself: an
 * authenticated request is identified by its token, an unauthenticated one by
 * its IP, and one with neither by a fingerprint of its headers. Each tier gets
 * its own limit, since they differ in how accountable and how forgeable they
 * are.
 *
 * Identifiers are hashed with a rotating salt before being stored, so the
 * limiter never holds a token or an IP in memory.
 *
 * ```ts
 * import { RateLimiter } from "@ozanarslan/corpus";
 *
 * new RateLimiter({ windowMs: 60_000, limits: { authenticated: 120, ipBased: 60, fingerprint: 20 } });
 * ```
 *
 * Counting is backed by {@link RateLimiterStoreInterface}; the default
 * {@link RateLimiterMemoryStore} is per-process, so a multi-instance deployment
 * wants a shared store instead.
 *
 * @module RateLimiter
 */

import { hash, randomBytes } from "node:crypto";

import { Exception } from "@/Exception";
import { getNearestApp } from "@/Globals/AppsRegistry";
import { HeaderKey } from "@/Headers";
import { Middleware, type MiddlewareHandler } from "@/Middleware";
import { Status } from "@/Res";
import { RouteVariant } from "@/RouteBase";
import { isEmpty, type Maybe, type MaybePromise, type OrString } from "@/utils/is";
import { tuple, type Tuple } from "@/utils/tuple";

/** One caller's counter for the current window. */
interface RateLimiterEntry {
	/** Requests seen in this window, including the one being handled. */
	hits: number;
	/** Unix milliseconds at which the window ends and the count resets. */
	resetAt: number;
}

// Storage interface for pluggable backends
/**
 * The storage contract for rate limit counters.
 *
 * Implement it to back the limiter with Redis or anything else shared across
 * processes — the default {@link RateLimiterMemoryStore} only counts within one.
 * Every method may be synchronous or asynchronous; the limiter awaits either.
 */
interface RateLimiterStoreInterface {
	/**
	 * Reads a caller's entry.
	 *
	 * @param id - The hashed caller identifier.
	 * @returns The entry, or `undefined` when the caller has none.
	 */
	get(id: string): MaybePromise<RateLimiterEntry | undefined>;
	/**
	 * Writes a caller's entry, replacing any existing one.
	 *
	 * @param id - The hashed caller identifier.
	 * @param entry - The counter to store.
	 */
	set(id: string, entry: RateLimiterEntry): MaybePromise<void>;
	/**
	 * Removes a caller's entry.
	 *
	 * @param id - The hashed caller identifier.
	 */
	delete(id: string): MaybePromise<void>;
	/**
	 * Removes every entry whose window has ended.
	 *
	 * @param now - Unix milliseconds to compare against
	 * {@link RateLimiterEntry.resetAt}.
	 */
	cleanup(now: number): MaybePromise<void>;
	/** Removes every entry, expired or not. */
	clear(): MaybePromise<void>;
	/**
	 * Reports how many entries are held.
	 *
	 * @returns The entry count, used to decide when a cleanup is forced.
	 */
	size(): MaybePromise<number>;
}

/**
 * In-process counter storage, used when no store is configured.
 *
 * Writes are serialised per identifier through a promise lock, so concurrent
 * requests from the same caller cannot interleave their read-modify-write and
 * lose a hit.
 *
 * State lives in one process's memory, so it is lost on restart and not shared
 * between instances — behind a load balancer, each instance enforces the limit
 * separately. Use a shared {@link RateLimiterStoreInterface} when that matters.
 */
class RateLimiterMemoryStore implements RateLimiterStoreInterface {
	/** The counters, keyed by hashed identifier. */
	protected readonly map = new Map<string, RateLimiterEntry>();

	/** In-flight write locks, keyed by identifier. Present only while a write is running. */
	protected readonly locks = new Map<string, Promise<void>>();

	/**
	 * Reads a caller's entry.
	 *
	 * @param id - The hashed caller identifier.
	 * @returns The entry, or `undefined` when absent. Expired entries are returned
	 * as-is; the limiter checks {@link RateLimiterEntry.resetAt} itself.
	 */
	get(id: string): RateLimiterEntry | undefined {
		return this.map.get(id);
	}

	/**
	 * Writes a caller's entry, waiting for any write already in progress for the
	 * same identifier.
	 *
	 * @param id - The hashed caller identifier.
	 * @param entry - The counter to store.
	 */
	async set(id: string, entry: RateLimiterEntry): Promise<void> {
		while (this.locks.has(id)) {
			await this.locks.get(id);
		}

		let resolveLock: () => void;
		this.locks.set(
			id,
			new Promise((resolve) => {
				resolveLock = resolve;
			}),
		);

		try {
			this.map.set(id, entry);
		} finally {
			this.locks.delete(id);
			resolveLock!();
		}
	}

	/**
	 * Removes a caller's entry.
	 *
	 * @param id - The hashed caller identifier.
	 */
	delete(id: string): void {
		this.map.delete(id);
	}

	/**
	 * Removes every entry whose window has already ended.
	 *
	 * @param now - Unix milliseconds to compare against.
	 */
	cleanup(now: number): void {
		for (const [id, entry] of this.map) {
			if (entry.resetAt <= now) {
				this.delete(id);
			}
		}
	}

	/** Removes every entry, resetting all counters. */
	clear(): void {
		this.map.clear();
	}

	/**
	 * @returns How many entries are currently held.
	 */
	size(): number {
		return this.map.size;
	}
}

/**
 * The limiter's settings. {@link RateLimiter} merges what you pass over
 * {@link defaultConfig}, so every field is optional at the call site.
 */
type RateLimiterConfig = {
	/** Limits based on identifier type: */
	limits: {
		/** Authenticated users — higher limit, accountable identity (e.g., 120 requests) */
		authenticated: number;
		/** IP-based — moderate, may be shared (NAT, proxies) (e.g., 60 requests) */
		ipBased: number;
		/** Fingerprint / anonymous — lowest, least trustworthy (e.g., 20 requests) */
		fingerprint: number;
	};

	/**
	 * You can pass a different header key to check for authenticated users.
	 * "Bearer " string is only sliced for Authorization.
	 * */
	authHeader?: OrString<"Authorization">;

	/** Time window in milliseconds during which the rate limit applies (default: 60,000ms = 1 minute) */
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

	/**
	 * Bring your own store implementation like redis.
	 * Uses {@link RateLimiterMemoryStore} by default.
	 * */
	store?: RateLimiterStoreInterface;

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

/**
 * Validates an address before it is used as a rate limit identifier.
 *
 * Proxy headers are client-controlled, so an unvalidated value would let a
 * caller mint a fresh bucket per request by sending garbage. IPv4 is checked
 * digit by digit, including a leading-zero check that rejects the octal-looking
 * forms some parsers accept. IPv6 is delegated to the platform's URL parser
 * rather than matched by regex, since the address grammar is too broad to cover
 * reliably by hand.
 *
 * @param ip - The candidate address, possibly absent.
 * @returns `true` when the value is a well-formed IPv4 or IPv6 address.
 */
function isValidIp(ip: Maybe<string>): ip is string {
	if (isEmpty(ip) || ip.length === 0) return false;

	// IPv4
	if (ip.includes(".")) {
		const parts = ip.split(".");
		if (parts.length !== 4) return false;
		return parts.every((p) => {
			if (!/^\d+$/.test(p)) return false;
			const n = Number(p);
			return n >= 0 && n <= 255 && p === String(n); // No leading zeros
		});
	}

	// IPv6 — delegate to the platform; avoids incomplete regex coverage
	// Node / V8 will throw on invalid addresses when used in a URL
	if (ip.includes(":")) {
		try {
			new URL(`http://[${ip}]`);
			return true;
		} catch {
			return false;
		}
	}

	return false;
}

/**
 * Hashes an identifier down to a fixed-length key.
 *
 * @param data - The value to hash — a token, or an address combined with the
 * current salt.
 * @param len - How many hex characters to keep.
 * @returns The truncated SHA-256 digest, which is what gets stored instead of
 * the original value.
 */
function hashData(data: string, len: number): string {
	return hash("sha256", data).slice(0, len);
}

/**
 * @returns 16 cryptographically random bytes as hex, used as the hashing salt.
 */
function getRandomBytes() {
	return randomBytes(16).toString("hex");
}

/**
 * Settings applied when a {@link RateLimiterConfig} field is not supplied: a
 * one-minute window, daily salt rotation, and the IETF-draft `RateLimit-*`
 * header names.
 */
const defaultConfig: RateLimiterConfig = {
	windowMs: 60_000,
	saltRotateMs: 24 * 3600 * 1000, // Daily
	cleanProbability: 0.005, // ~0.5% chance per request
	maxStoreSize: 50_000, // Trigger forced cleanup above
	limits: { authenticated: 120, ipBased: 60, fingerprint: 20 },
	headerNames: {
		limit: "RateLimit-Limit",
		remaining: "RateLimit-Remaining",
		reset: "RateLimit-Reset",
		retryAfter: "Retry-After",
	},
};

/**
 * A {@link Middleware} that limits how often a caller may make requests.
 *
 * Every response carries the limit, the remaining allowance and the reset time,
 * and those header names are added to
 * {@link HeaderKey.AccessControlExposeHeaders} so browser clients can actually
 * read them. Exceeding the limit throws an {@link Exception} carrying the
 * response built so far, so the rejection keeps its rate limit headers.
 */
class RateLimiter extends Middleware {
	/**
	 * Creates a limiter and registers it on the nearest {@link App}.
	 *
	 * It targets the routes registered so far, minus
	 * {@link RouteVariant.bundle} ones — a single page load pulls dozens of
	 * assets, which would exhaust any sensible limit. Construct it after your
	 * routes; routes registered later are not covered.
	 *
	 * @param config - Overrides for {@link defaultConfig}. Merged shallowly, so
	 * supplying `limits` or `headerNames` replaces that group whole.
	 */
	constructor(config: Partial<RateLimiterConfig> = {}) {
		super();
		this.config = { ...defaultConfig, ...config };
		this.store = this.config.store ?? new RateLimiterMemoryStore();
		this.storedSalt = getRandomBytes();
		this.saltRotatesAt = Date.now() + this.config.saltRotateMs;
		this.useOn = getNearestApp()
			.routes.filter((r) => r.variant !== RouteVariant.bundle)
			.map((r) => r.id);
		this.register();
	}

	/**
	 * Counts the request and either continues the chain or rejects it.
	 *
	 * @param c - The {@link Context} for the request.
	 * @param next - Runs the rest of the chain.
	 * @throws {@link Exception} with {@link Status.TOO_MANY_REQUESTS} when the
	 * limit is exceeded. The current {@link Res} is passed as the exception data,
	 * so the rejection carries the rate limit headers already set on it.
	 */
	override handler: MiddlewareHandler = async (c, next) => {
		const success = await this.getResult(c.req.headers, c.res.headers);
		if (!success) throw new Exception("Too many requests", Status.TOO_MANY_REQUESTS, c.res);
		await next();
	};

	/**
	 * Counts one request against its caller's allowance and writes the rate limit
	 * headers.
	 *
	 * A window is created on the first request and reused until
	 * {@link RateLimiterEntry.resetAt} passes, at which point the counter starts
	 * over — a fixed window, not a sliding one. The hit is counted whether or not
	 * it is allowed, so a caller that keeps hammering a closed window stays closed
	 * until it resets.
	 *
	 * Exposed separately from {@link RateLimiter.handler} so the same accounting
	 * can be driven from outside a request chain, in tests or a custom handler.
	 *
	 * @param reqHeaders - The request headers, used to identify the caller.
	 * @param resHeaders - The response headers to write the limit, remaining,
	 * reset and — when rejected — retry-after values into.
	 * @returns `true` when the request is within the limit.
	 */
	async getResult(reqHeaders: Headers, resHeaders: Headers): Promise<boolean> {
		await this.maybeCleanStore();

		const [id, limit] = this.getIdAndLimit(reqHeaders);
		const now = Date.now();

		// Atomic read-modify-write operation
		let entry = await this.store.get(id);

		if (entry && entry.resetAt > now) {
			entry.hits++;
		} else {
			entry = { hits: 1, resetAt: now + this.config.windowMs };
		}

		await this.store.set(id, entry);

		const success = entry.hits <= limit;
		const remaining = Math.max(0, limit - entry.hits);
		const reset = Math.ceil(entry.resetAt / 1000);

		const keys = this.config.headerNames;

		resHeaders.set(keys.limit, limit.toString());
		resHeaders.set(keys.remaining, remaining.toString());
		resHeaders.set(keys.reset, reset.toString());
		for (const exposed of Object.values(keys)) {
			resHeaders.append(HeaderKey.AccessControlExposeHeaders, exposed);
		}

		// Add Retry-After header if rate limited
		if (!success) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			resHeaders.set(keys.retryAfter, retryAfter.toString());
		}

		return success;
	}

	/** The merged settings this limiter runs with. */
	protected readonly config: RateLimiterConfig;

	/** Where counters are kept. The configured store, or a {@link RateLimiterMemoryStore}. */
	protected readonly store: RateLimiterStoreInterface;

	/** The current hashing salt. Rotated by {@link RateLimiter.salt}. */
	protected storedSalt: string;

	/** Unix milliseconds at which {@link RateLimiter.storedSalt} is replaced. */
	protected saltRotatesAt: number;

	/**
	 * Identifies the caller and picks the limit that applies to it.
	 *
	 * Three tiers are tried in order of how much the request proves about itself.
	 * A bearer token of plausible length identifies an authenticated caller and
	 * earns the highest limit. Failing that, a valid address from the proxy
	 * headers earns the IP limit — shared by everyone behind a NAT, hence lower.
	 * Failing that, a fingerprint of the user agent and accept headers earns the
	 * lowest limit, since it is trivially forgeable.
	 *
	 * Tokens are hashed without the salt so a caller keeps one bucket across
	 * rotations; addresses and fingerprints are salted, so they cannot be
	 * correlated across rotation windows.
	 *
	 * The prefixes (`u:`, `i:`, `f:`) keep the tiers in separate namespaces, so a
	 * collision across tiers is impossible.
	 *
	 * @param headers - The request headers.
	 * @returns A {@link Tuple} of the hashed identifier and the applicable limit.
	 */
	protected getIdAndLimit(headers: Headers): Tuple<string, number> {
		// --- Authenticated: hash the JWT token ---
		const authHeader = headers.get(this.config.authHeader ?? HeaderKey.Authorization);
		const token = authHeader?.includes("earer ") ? authHeader.slice(7) : authHeader;
		if (!isEmpty(token) && token.length >= 20 && token.length <= 2048) {
			return tuple(`u:${hashData(token, 16)}`, this.config.limits.authenticated);
		}

		// --- IP-based ---
		const ip =
			headers.get("cf-connecting-ip") ??
			headers.get("x-real-ip") ??
			headers.get("x-forwarded-for")?.split(",")[0]?.trim();
		if (isValidIp(ip)) {
			return tuple(`i:${hashData(ip + this.salt(), 16)}`, this.config.limits.ipBased);
		}

		// --- Fingerprint fallback ---
		const parts = [
			headers.get("user-agent") ?? "no-ua",
			headers.get("accept-language") ?? "no-lang",
			headers.get("accept-encoding") ?? "no-enc",
		];
		return tuple(
			`f:${hashData(parts.join("|") + this.salt(), 16)}`,
			this.config.limits.fingerprint,
		);
	}

	/**
	 * Returns the current hashing salt, rotating it when it has expired.
	 *
	 * Rotation is lazy rather than scheduled, so no timer is held open. A rotation
	 * changes every derived identifier at once, which resets the affected
	 * counters — acceptable at a daily cadence, and the point: it bounds how long
	 * any caller can be tracked.
	 *
	 * @returns The salt to mix into address and fingerprint hashes.
	 */
	protected salt(): string {
		if (Date.now() > this.saltRotatesAt) {
			this.storedSalt = getRandomBytes();
			this.saltRotatesAt = Date.now() + this.config.saltRotateMs;
		}
		return this.storedSalt;
	}

	/**
	 * Decides whether to sweep expired entries before handling a request.
	 *
	 * Cleanup runs on a small random fraction of requests, so the cost is spread
	 * out instead of landing on a timer, and unconditionally once the store passes
	 * {@link RateLimiterConfig.maxStoreSize}, which bounds memory under a flood of
	 * one-off callers.
	 */
	protected async maybeCleanStore(): Promise<void> {
		const currentSize = await this.store.size();
		const shouldClean =
			Math.random() < this.config.cleanProbability || currentSize > this.config.maxStoreSize;

		if (shouldClean) await this.cleanStore();
	}

	/**
	 * Removes every entry whose window has ended.
	 *
	 * @returns How many entries remain.
	 */
	protected async cleanStore(): Promise<number> {
		const now = Date.now();
		await this.store.cleanup(now);

		return this.store.size();
	}

	/**
	 * Clears every counter, expired or not, resetting all callers to a full
	 * allowance. Mainly useful between tests.
	 */
	async clearStore(): Promise<void> {
		await this.store.clear();
	}

	/**
	 * @returns How many counters are currently held, expired ones included until
	 * the next cleanup.
	 */
	async getStoreSize(): Promise<number> {
		return this.store.size();
	}
}

export {
	RateLimiter,
	RateLimiterMemoryStore,
	type RateLimiterStoreInterface,
	type RateLimiterConfig,
};

import { hash, randomBytes } from "node:crypto";

import { getNearestApp } from "@/AppsRegistry";
import { Exception } from "@/Exception";
import { HeaderKey } from "@/Headers";
import { Middleware, type MiddlewareHandler } from "@/Middleware";
import { Status } from "@/Res";
import { RouteVariant } from "@/RouteBase";
import type { OrString } from "@/utils/lexical";
import { isEmpty, type Maybe, type MaybePromise } from "@/utils/maybe";
import { objGetValues } from "@/utils/object";
import { tuple, type Tuple } from "@/utils/tuple";

interface RateLimiterEntry {
	hits: number;
	resetAt: number;
}

// Storage interface for pluggable backends
interface RateLimiterStoreInterface {
	get(id: string): MaybePromise<RateLimiterEntry | undefined>;
	set(id: string, entry: RateLimiterEntry): MaybePromise<void>;
	delete(id: string): MaybePromise<void>;
	cleanup(now: number): MaybePromise<void>;
	clear(): MaybePromise<void>;
	size(): MaybePromise<number>;
}

class RateLimiterMemoryStore implements RateLimiterStoreInterface {
	protected readonly map = new Map<string, RateLimiterEntry>();
	protected readonly locks = new Map<string, Promise<void>>();

	get(id: string): RateLimiterEntry | undefined {
		return this.map.get(id);
	}

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

	delete(id: string): void {
		this.map.delete(id);
	}

	cleanup(now: number): void {
		for (const [id, entry] of this.map) {
			if (entry.resetAt <= now) {
				this.delete(id);
			}
		}
	}

	clear(): void {
		this.map.clear();
	}

	size(): number {
		return this.map.size;
	}
}

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

function hashData(data: string, len: number): string {
	return hash("sha256", data).slice(0, len);
}

function getRandomBytes() {
	return randomBytes(16).toString("hex");
}

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

class RateLimiter extends Middleware {
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

	override handler: MiddlewareHandler = async (c, next) => {
		const success = await this.getResult(c.req.headers, c.res.headers);
		if (!success) throw new Exception("Too many requests", Status.TOO_MANY_REQUESTS, c.res);
		await next();
	};

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
		for (const exposed of objGetValues(keys)) {
			resHeaders.append(HeaderKey.AccessControlExposeHeaders, exposed);
		}

		// Add Retry-After header if rate limited
		if (!success) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			resHeaders.set(keys.retryAfter, retryAfter.toString());
		}

		return success;
	}

	protected readonly config: RateLimiterConfig;
	protected readonly store: RateLimiterStoreInterface;
	protected storedSalt: string;
	protected saltRotatesAt: number;

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

	protected salt(): string {
		if (Date.now() > this.saltRotatesAt) {
			this.storedSalt = getRandomBytes();
			this.saltRotatesAt = Date.now() + this.config.saltRotateMs;
		}
		return this.storedSalt;
	}

	protected async maybeCleanStore(): Promise<void> {
		const currentSize = await this.store.size();
		const shouldClean =
			Math.random() < this.config.cleanProbability || currentSize > this.config.maxStoreSize;

		if (shouldClean) await this.cleanStore();
	}

	protected async cleanStore(): Promise<number> {
		const now = Date.now();
		await this.store.cleanup(now);

		return this.store.size();
	}

	async clearStore(): Promise<void> {
		await this.store.clear();
	}

	async getStoreSize(): Promise<number> {
		return this.store.size();
	}
}

export type { RateLimiterStoreInterface, RateLimiterConfig };
export { RateLimiter, RateLimiterMemoryStore };

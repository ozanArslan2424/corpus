import crypto from "crypto";

import { isNil, isEmpty, objGetEntries, objGetValues } from "@ozanarslan/utils";

import { Exception } from "@/C/Exception";
import { HeaderKey } from "@/C/HeaderKey";
import { MiddlewareAbstract } from "@/C/MiddlewareAbstract";
import type { MiddlewareUseOn, MiddlewareHandler } from "@/C/MiddlewareAbstract/types";
import { RouteVariant } from "@/C/Route/types";
import { Status } from "@/C/Status";
import { $registry } from "@/Registry/$registry";
import { RateLimiterMemoryStore } from "@/X/RateLimiter/RateLimiterMemoryStore";
import type {
	RateLimitConfig,
	RateLimitStoreInterface,
	RateLimitIdPrefix,
} from "@/X/RateLimiter/types";

export class RateLimiter extends MiddlewareAbstract {
	constructor(config: Partial<RateLimitConfig> = {}) {
		super();
		this.config = { ...this.defaultConfig, ...config };
		this.store = this.resolveStore();
		this.storedSalt = this.getRandomBytes();
		this.saltRotatesAt = Date.now() + this.config.saltRotateMs;
		this.register();
	}

	override get useOn(): MiddlewareUseOn {
		return $registry.router
			.list()
			.filter((r) => r.variant !== RouteVariant.bundle)
			.map((r) => r.id);
	}

	override handler: MiddlewareHandler = async (c, next) => {
		const result = await this.getResult(c.req.headers);

		for (const [key, value] of objGetEntries(result.headersObject)) {
			if (Array.isArray(value)) {
				for (const header of value) {
					c.res.headers.append(key, header);
				}
			} else {
				c.res.headers.set(key, value);
			}
		}

		if (!result.success) {
			throw new Exception("Too many requests", Status.TOO_MANY_REQUESTS, c.res);
		}

		await next();
	};

	private readonly config: RateLimitConfig;
	private readonly store: RateLimitStoreInterface;
	private storedSalt: string;
	private saltRotatesAt: number;

	async getResult(headers: Headers): Promise<{
		success: boolean;
		headersObject: Record<string, string | Array<string>>;
	}> {
		await this.maybeCleanStore();

		const id = this.getId(headers);
		const now = Date.now();

		// Atomic read-modify-write operation
		let entry = await this.store.get(id);

		if (entry && entry.resetAt > now) {
			entry.hits++;
		} else {
			entry = { hits: 1, resetAt: now + this.config.windowMs };
		}

		await this.store.set(id, entry);

		const max = this.getMax(id);
		const allowed = entry.hits <= max;
		const remaining = Math.max(0, max - entry.hits);
		const resetUnix = Math.ceil(entry.resetAt / 1000);

		const keys = this.config.headerNames;

		const headersObject = {
			[keys.limit]: max.toString(),
			[keys.remaining]: remaining.toString(),
			[keys.reset]: resetUnix.toString(),
			[HeaderKey.AccessControlExposeHeaders]: objGetValues(keys),
		};

		// Add Retry-After header if rate limited
		if (!allowed) {
			const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
			headersObject[keys.retryAfter] = retryAfter.toString();
		}

		if (allowed) {
			return { headersObject, success: true };
		}

		return { headersObject, success: false };
	}

	private getId(headers: Headers): string {
		// --- Authenticated: hash the JWT token ---
		const authHeader = headers.get(HeaderKey.Authorization);
		const token = authHeader?.split(" ")[1];
		if (!isEmpty(token) && token.length >= 20 && token.length <= 2048) {
			return `u:${this.hash(token, 16)}`;
		}

		// --- IP-based ---
		const ip = this.extractIp(headers);
		if (ip !== null) {
			return `i:${this.hash(ip + this.salt(), 16)}`;
		}

		// --- Fingerprint fallback ---
		const parts = [
			headers.get("user-agent") ?? "no-ua",
			headers.get("accept-language") ?? "no-lang",
			headers.get("accept-encoding") ?? "no-enc",
		];
		return `f:${this.hash(parts.join("|") + this.salt(), 16)}`;
	}

	private getMax(id: string): number {
		const prefix = id.charAt(0) as RateLimitIdPrefix;
		return this.config.limits[prefix];
	}

	private extractIp(headers: Headers): string | null {
		const raw =
			headers.get("cf-connecting-ip") ??
			headers.get("x-real-ip") ??
			headers.get("x-forwarded-for")?.split(",")[0]?.trim();

		return this.isValidIp(raw) ? raw : null;
	}

	private isValidIp(ip: string | null | undefined): ip is string {
		if (!!isEmpty(ip) || ip.length === 0) return false;

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

	private salt(): string {
		if (Date.now() > this.saltRotatesAt) {
			this.storedSalt = this.getRandomBytes();
			this.saltRotatesAt = Date.now() + this.config.saltRotateMs;
		}
		return this.storedSalt;
	}

	private async maybeCleanStore(): Promise<void> {
		const currentSize = await this.store.size();
		const shouldClean =
			Math.random() < this.config.cleanProbability || currentSize > this.config.maxStoreSize;

		if (shouldClean) await this.cleanStore();
	}

	private async cleanStore(): Promise<number> {
		const now = Date.now();
		await this.store.cleanup(now);

		return this.store.size();
	}

	private hash(data: string, len: number): string {
		return crypto.hash("sha256", data).slice(0, len);
	}

	private getRandomBytes() {
		return crypto.randomBytes(16).toString("hex");
	}

	async clearStore(): Promise<void> {
		await this.store.clear();
	}

	async getStoreSize(): Promise<number> {
		return this.store.size();
	}

	private readonly defaultConfig: RateLimitConfig = {
		windowMs: 60_000,
		saltRotateMs: 24 * 3600 * 1000, // Daily
		cleanProbability: 0.005, // ~0.5% chance per request
		maxStoreSize: 50_000, // Trigger forced cleanup above
		limits: { u: 120, i: 60, f: 20 },
		headerNames: {
			limit: "RateLimit-Limit",
			remaining: "RateLimit-Remaining",
			reset: "RateLimit-Reset",
			retryAfter: "Retry-After",
		},
	};

	private resolveStore(): RateLimitStoreInterface {
		if (isNil(this.config.store)) {
			return new RateLimiterMemoryStore();
		}
		return this.config.store;
	}
}

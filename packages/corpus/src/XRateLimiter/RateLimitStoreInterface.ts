import type { RateLimitEntry } from "@/XRateLimiter/RateLimitEntry";

// Storage interface for pluggable backends
export interface RateLimitStoreInterface {
	get(id: string): Bun.MaybePromise<RateLimitEntry | undefined>;
	set(id: string, entry: RateLimitEntry): Bun.MaybePromise<void>;
	delete(id: string): Bun.MaybePromise<void>;
	cleanup(now: number): Bun.MaybePromise<void>;
	clear(): Bun.MaybePromise<void>;
	size(): Bun.MaybePromise<number>;
}

# Redis Adapter Example

This example uses the popular "redis" package: `bun add redis`

```ts
import type { createClient } from "redis";
import type { X } from "@ozanarslan/corpus";

export class RateLimiterRedisStore implements X.RateLimitStoreInterface {
	constructor(
		private readonly redis: ReturnType<typeof createClient>,
		private readonly prefix: string = "rl:",
	) {}

	async get(id: string): Promise<X.RateLimitEntry | undefined> {
		const data = await this.redis.get(this.prefix + id);
		return data ? JSON.parse(data) : undefined;
	}

	async set(id: string, entry: X.RateLimitEntry): Promise<void> {
		await this.redis.set(this.prefix + id, JSON.stringify(entry), {
			expiration: {
				type: "PX",
				value: Math.max(0, entry.resetAt - Date.now()),
			},
		});
	}

	async delete(id: string): Promise<void> {
		await this.redis.del(this.prefix + id);
	}

	async cleanup(_now: number): Promise<void> {
		// Redis handles expiration automatically
		// This is a no-op
	}

	async clear(): Promise<void> {
		const keys = await this.redis.keys(this.prefix + "*");
		if (keys.length > 0) {
			await this.redis.del(keys);
		}
	}

	async size(): Promise<number> {
		const keys = await this.redis.keys(this.prefix + "*");
		return keys.length;
	}
}
```

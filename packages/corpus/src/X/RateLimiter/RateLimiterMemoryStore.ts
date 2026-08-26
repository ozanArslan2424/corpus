import type { RateLimitEntry, RateLimitStoreInterface } from "@/X/RateLimiter/RateLimiter.types";

export class RateLimiterMemoryStore implements RateLimitStoreInterface {
	private readonly store = new Map<string, RateLimitEntry>();
	private readonly locks = new Map<string, Promise<void>>();

	get(id: string): RateLimitEntry | undefined {
		return this.store.get(id);
	}

	async set(id: string, entry: RateLimitEntry): Promise<void> {
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
			this.store.set(id, entry);
		} finally {
			this.locks.delete(id);
			resolveLock!();
		}
	}

	delete(id: string): void {
		this.store.delete(id);
	}

	cleanup(now: number): void {
		for (const [id, entry] of this.store) {
			if (entry.resetAt <= now) {
				this.delete(id);
			}
		}
	}

	clear(): void {
		this.store.clear();
	}

	size(): number {
		return this.store.size;
	}
}

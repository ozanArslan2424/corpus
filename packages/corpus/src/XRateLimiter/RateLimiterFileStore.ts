import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { RateLimitEntry } from "@/XRateLimiter/RateLimitEntry";
import type { RateLimitStoreInterface } from "@/XRateLimiter/RateLimitStoreInterface";

export class RateLimiterFileStore implements RateLimitStoreInterface {
	private readonly storeDir: string;
	private readonly locks = new Map<string, Promise<void>>();

	constructor(storeDir?: string) {
		this.storeDir = storeDir ?? path.join(os.tmpdir(), "rate-limit-store");
		this.ensureStoreDir();
	}

	private ensureStoreDir() {
		fs.mkdir(this.storeDir, { recursive: true }).catch((err) => {
			throw new Exception(
				"Rate Limit File Store Directory could not be created",
				Status.INTERNAL_SERVER_ERROR,
				err,
			);
		});
	}

	private getFilePath(id: string): string {
		const safeId = crypto.hash("sha256", id).slice(0, 32);
		return path.join(this.storeDir, `${safeId}.json`);
	}

	async get(id: string): Promise<RateLimitEntry | undefined> {
		try {
			const data = await fs.readFile(this.getFilePath(id), "utf-8");
			return JSON.parse(data);
		} catch {
			return undefined;
		}
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
			await fs.writeFile(this.getFilePath(id), JSON.stringify(entry), "utf-8");
		} finally {
			this.locks.delete(id);
			resolveLock!();
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await fs.unlink(this.getFilePath(id));
		} catch {
			// File doesn't exist
		}
	}

	async cleanup(now: number): Promise<void> {
		const files = await fs.readdir(this.storeDir);

		for (const file of files) {
			if (!file.endsWith(".json")) continue;

			try {
				const data = await fs.readFile(path.join(this.storeDir, file), "utf-8");
				const entry = JSON.parse(data) as RateLimitEntry;

				if (entry.resetAt <= now) {
					await fs.unlink(path.join(this.storeDir, file));
				}
			} catch {
				// Skip invalid files
			}
		}
	}

	async clear(): Promise<void> {
		const files = await fs.readdir(this.storeDir);

		for (const file of files) {
			if (file.endsWith(".json")) {
				await fs.unlink(path.join(this.storeDir, file));
			}
		}
	}

	async size(): Promise<number> {
		const files = await fs.readdir(this.storeDir);
		return files.filter((f) => f.endsWith(".json")).length;
	}
}

import { FileWalkerAbstract } from "@/FileWalker/FileWalkerAbstract";
import type { FileWalkerFile } from "@/FileWalker/types/FileWalkerFile";
import fs from "fs";
import path from "path";

export class FileWalkerUsingNode extends FileWalkerAbstract {
	async read(address: string): Promise<string | null> {
		try {
			const file = await this.find(address);
			if (!file) return null;
			return await file.text();
		} catch {
			return null;
		}
	}

	async exists(address: string): Promise<boolean> {
		return fs.existsSync(address);
	}

	getExtension(address: string): string {
		return path.extname(address).toLowerCase().replace(".", "");
	}

	async find(address: string): Promise<FileWalkerFile | null> {
		try {
			const exists = this.exists(address);
			if (!exists) return null;
			return {
				text: async () => fs.readFileSync(address, "utf-8"),
			};
		} catch {
			return null;
		}
	}
}

import type { FileWalkerFile } from "@/FileWalker/types/FileWalkerFile";

export class FileWalkerUsingBun {
	static async read(address: string): Promise<string | null> {
		try {
			const file = await this.find(address);
			if (!file) return null;
			return await file.text();
		} catch {
			return null;
		}
	}

	static async exists(address: string): Promise<boolean> {
		return (await this.find(address)) !== null;
	}

	static getExtension(address: string): string {
		return address.split(".").pop() ?? "txt";
	}

	static async find(address: string): Promise<FileWalkerFile | null> {
		const file = Bun.file(address);
		const exists = await file.exists();
		if (exists) {
			return { text: () => file.text() };
		}
		return null;
	}
}

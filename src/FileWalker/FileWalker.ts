import { FileWalkerUsingBun } from "@/FileWalker/FileWalkerUsingBun";
import type { FileWalkerFile } from "@/FileWalker/types/FileWalkerFile";

// TODO: Node support
export class FileWalker {
	private static instance = new FileWalkerUsingBun();

	static read(address: string): Promise<string | null> {
		return this.instance.read(address);
	}

	static exists(address: string): Promise<boolean> {
		return this.instance.exists(address);
	}

	static getExtension(address: string): string {
		return this.instance.getExtension(address);
	}

	static find(address: string): Promise<FileWalkerFile | null> {
		return this.instance.find(address);
	}
}

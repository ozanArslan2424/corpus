import type { FileWalkerFile } from "@/FileWalker/types/FileWalkerFile";

export abstract class FileWalkerAbstract {
	abstract read(address: string): Promise<string | null>;
	abstract exists(address: string): Promise<boolean>;
	abstract getExtension(address: string): string;
	abstract find(address: string): Promise<FileWalkerFile | null>;
}

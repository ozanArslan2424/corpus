import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export class XFile {
	constructor(
		/** The path of the file or BunFile directly. */
		pathOrBunFile: string | Bun.BunFile,
		/** Fallback extension for extension-less files, defaults to "txt" */
		private readonly fallbackExtension: string = "txt",
	) {
		if (typeof pathOrBunFile === "string") {
			this.path = pathOrBunFile;
			this.bunFile = Bun.file(pathOrBunFile);
		} else {
			this.path = pathOrBunFile.name ?? "";
			this.bunFile = pathOrBunFile;
		}
	}

	readonly bunFile: Bun.BunFile;
	readonly path: string;

	private readonly SLASH = "/";
	private readonly DOT = ".";
	private readonly EMPTY = "";
	private readonly concat = (...parts: string[]) => parts.join(this.EMPTY);

	/**
	 * Reads the file content and returns it as a string.
	 * @param encoding defaults to "utf8"
	 */
	async text(encoding: BufferEncoding = "utf8"): Promise<string> {
		if (encoding === "utf8" || encoding === "utf-8") return this.bunFile.text();
		return fs.readFile(this.path, { encoding });
	}

	/** Opens a readable stream to the file's content. */
	async stream(): Promise<ReadableStream<Uint8Array>> {
		return this.bunFile.stream();
	}

	/** Checks if the file exists in the file system. */
	async exists(): Promise<boolean> {
		// Bun.file().exists() caches and the bunFile instance is
		// created before the file gets deleted
		// needs a fresh instance
		return Bun.file(this.path).exists();
	}

	/** Writes to the file, directories are created recursively. */
	async write(data: string | ArrayBuffer | Uint8Array): Promise<void> {
		await fs.mkdir(path.dirname(this.path), { recursive: true });
		await Bun.write(this.bunFile, data);
	}

	/** Deletes the file. */
	async unlink(): Promise<void> {
		await this.bunFile.unlink();
	}

	/** Reads the file content and returns it as a Uint8Array. */
	async bytes(): Promise<Uint8Array> {
		return this.bunFile.bytes();
	}

	/** Returns file metadata (size, dates, etc.) */
	async stat(): Promise<Stats> {
		return fs.stat(this.path);
	}

	/** Returns the file size in bytes, or null if the file doesn't exist. */
	async size(): Promise<number | null> {
		if (!(await this.bunFile.exists())) return null;
		return this.bunFile.size;
	}

	/** Copies the file to a destination path, creating directories recursively. */
	async copyTo(dest: string): Promise<XFile> {
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.copyFile(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/** Moves (renames) the file to a destination path, creating directories recursively. */
	async moveTo(dest: string): Promise<XFile> {
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.rename(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/** Appends data to the file. */
	async append(data: string | Uint8Array): Promise<void> {
		await fs.appendFile(this.path, data);
	}

	/** Returns a new XFile pointing to a sibling path (same directory, different name). */
	sibling(filename: string): XFile {
		return new XFile(path.join(path.dirname(this.path), filename), this.fallbackExtension);
	}

	/** Returns a new XFile with a different extension. */
	withExtension(ext: string): XFile {
		return new XFile(
			path.join(path.dirname(this.path), this.concat(this.name, this.DOT, ext)),
			this.fallbackExtension,
		);
	}

	/** The absolute directory path containing this file. */
	get dir(): string {
		return path.dirname(this.path);
	}

	/** The name of the file without the extension. */
	get name(): string {
		const last = this.path.split(this.SLASH).pop() ?? this.path;
		return last.replace(this.concat(this.DOT, this.extension), this.EMPTY);
	}

	/** The file extension (e.g., "html", "md"), excluding the leading dot. */
	get extension(): string {
		const last = this.path.split(this.SLASH).pop() ?? this.EMPTY;
		if (!last.includes(this.DOT)) return this.fallbackExtension.toLowerCase();
		const ext = last.split(this.DOT).pop() ?? this.fallbackExtension;
		return ext.toLowerCase();
	}

	/** The full name of the file, including the extension. */
	get fullname(): string {
		return this.concat(this.name, this.DOT, this.extension);
	}

	/** Gets the parent directory names as an array, ordered from the immediate parent up to the root. */
	get parentDirs(): string[] {
		const parts = this.path.split(this.SLASH);
		parts.pop();
		return parts.filter((seg) => seg.length > 0).reverse();
	}

	/** The standard MIME type associated with the file's extension. */
	get mimeType(): string {
		const type = Bun.file(`file.${this.extension}`).type;
		if (!type || type === "application/octet-stream") return "application/octet-stream";
		return type.split(";")[0]?.trim() ?? "application/octet-stream";
	}
}

import fs from "fs";
import path from "path";

class XFile {
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

	private readonly SEP = /[\\/]/;
	private readonly DOT = ".";
	private readonly EMPTY = "";
	private readonly concat = (...parts: string[]) => parts.join(this.EMPTY);

	/**
	 * Reads the file content and returns it as a string.
	 * @param encoding defaults to "utf8"
	 */
	text(encoding: BufferEncoding = "utf8"): string {
		return fs.readFileSync(this.path, { encoding });
	}

	/** Opens a readable stream to the file's content. */
	stream(): ReadableStream<Uint8Array> {
		return this.bunFile.stream();
	}

	/** Checks if the file exists in the file system. */
	exists(): boolean {
		// Bun.file().exists() caches and the bunFile instance is
		// created before the file gets deleted
		// needs a fresh instance
		return fs.existsSync(this.path);
	}

	/** Writes to the file, directories are created recursively. */
	write(data: string | ArrayBuffer | Uint8Array): void {
		fs.mkdirSync(path.dirname(this.path), { recursive: true });
		fs.writeFileSync(this.path, data instanceof ArrayBuffer ? Buffer.from(data) : data);
	}

	/** Deletes the file. */
	unlink(): void {
		fs.unlinkSync(this.path);
	}

	/** Reads the file content and returns it as a Uint8Array. */
	bytes(): Buffer<ArrayBuffer> {
		return fs.readFileSync(this.path);
	}

	/** Returns file metadata (size, dates, etc.) */
	stat(): fs.Stats {
		return fs.statSync(this.path);
	}

	/** Returns the file size in bytes, or null if the file doesn't exist. */
	size(): number | null {
		if (!fs.existsSync(this.path)) return null;
		return fs.statSync(this.path).size;
	}

	/** Copies the file to a destination path, creating directories recursively. */
	copyTo(dest: string): XFile {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/** Moves (renames) the file to a destination path, creating directories recursively. */
	moveTo(dest: string): XFile {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.renameSync(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/** Appends data to the file. */
	append(data: string | Uint8Array): void {
		fs.appendFileSync(this.path, data);
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
		const last = this.path.split(this.SEP).pop() ?? this.path;
		return last.replace(this.concat(this.DOT, this.extension), this.EMPTY);
	}

	/** The file extension (e.g., "html", "md"), excluding the leading dot. */
	get extension(): string {
		const last = this.path.split(this.SEP).pop() ?? this.EMPTY;
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
		const parts = this.path.split(this.SEP);
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

export { XFile };

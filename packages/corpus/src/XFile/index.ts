/**
 * File handling for the routes that serve files.
 *
 * {@link XFile} wraps a path with the reads, writes and path manipulation the
 * framework needs, so {@link FileRoute}, {@link StaticRoute},
 * {@link BundleRoute} and {@link Res.file} all go through one place instead of
 * each reaching for `fs` and `path` themselves.
 *
 * It sits on both Bun's file API and Node's `fs`, choosing per operation: Bun's
 * for streaming, Node's for everything where Bun's caching would give a stale
 * answer.
 *
 * @module XFile
 */

import fs from "fs";
import path from "path";

/**
 * A file at a path.
 *
 * The path is the only state; nothing is read at construction, so an XFile
 * doesn't officially exist (get it?) and can be written from scratch.
 * The path-manipulation members — {@link XFile.name}, {@link XFile.extension},
 * {@link XFile.sibling} — are pure string work and never touch the disk.
 *
 * Reads are synchronous. The routes that use it read either once at startup or
 * per request from the OS page cache, so the simpler API is worth more than the
 * async one.
 */
class XFile {
	/**
	 * Creates a file handle. Nothing is read or checked until an operation asks
	 * for it.
	 *
	 * @param pathOrBunFile - The path of the file or BunFile directly.
	 * @param fallbackExtension - Fallback extension for extension-less files,
	 * defaults to "txt". It decides what {@link XFile.mimeType} reports for a file
	 * whose name carries no extension.
	 */
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

	/** The underlying Bun file, used for streaming. */
	readonly bunFile: Bun.BunFile;

	/** The path this handle points at, as given. */
	readonly path: string;

	/** Matches either path separator, so paths split correctly on any platform. */
	private readonly SEP = /[\\/]/;

	/** The extension separator. */
	private readonly DOT = ".";

	/** The empty string, used as a join separator and a replacement target. */
	private readonly EMPTY = "";

	/**
	 * Joins parts with no separator.
	 *
	 * @param parts - The strings to concatenate.
	 * @returns The joined string.
	 */
	private readonly concat = (...parts: string[]) => parts.join(this.EMPTY);

	/**
	 * Reads the file content and returns it as a string.
	 * @param encoding defaults to "utf8"
	 * @returns The decoded contents.
	 * @throws {@link Error} when the file does not exist.
	 */
	text(encoding: BufferEncoding = "utf8"): string {
		return fs.readFileSync(this.path, { encoding });
	}

	/**
	 * Opens a readable stream to the file's content.
	 *
	 * @returns The stream. This is what the file-serving routes return for large
	 * bodies, so nothing is buffered in memory.
	 */
	stream(): ReadableStream<Uint8Array> {
		return this.bunFile.stream();
	}

	/**
	 * Checks if the file exists in the file system.
	 *
	 * Deliberately uses Node's `fs` rather than Bun's: `Bun.file().exists()`
	 * caches, and this handle's `BunFile` was created before the file may have
	 * been deleted, so it would report a stale answer.
	 *
	 * @returns `true` when the file exists right now.
	 */
	exists(): boolean {
		// Bun.file().exists() caches and the bunFile instance is
		// created before the file gets deleted
		// needs a fresh instance
		return fs.existsSync(this.path);
	}

	/**
	 * Writes to the file, directories are created recursively.
	 *
	 * @param data - The contents to write, replacing anything already there.
	 */
	write(data: string | ArrayBuffer | Uint8Array): void {
		fs.mkdirSync(path.dirname(this.path), { recursive: true });
		fs.writeFileSync(this.path, data instanceof ArrayBuffer ? Buffer.from(data) : data);
	}

	/**
	 * Deletes the file.
	 *
	 * @throws {@link Error} when the file does not exist.
	 */
	unlink(): void {
		fs.unlinkSync(this.path);
	}

	/**
	 * Reads the file content and returns it as a Uint8Array.
	 *
	 * @returns The raw bytes. Used where an exact `Content-Length` is wanted; see
	 * {@link XFile.stream} for the alternative.
	 * @throws {@link Error} when the file does not exist.
	 */
	bytes(): Buffer<ArrayBuffer> {
		return fs.readFileSync(this.path);
	}

	/**
	 * Returns file metadata (size, dates, etc.)
	 *
	 * @returns The stats.
	 * @throws {@link Error} when the file does not exist.
	 */
	stat(): fs.Stats {
		return fs.statSync(this.path);
	}

	/**
	 * Returns the file size in bytes, or null if the file doesn't exist. Unlike
	 * {@link XFile.stat}, a missing file is not an error here.
	 *
	 * @returns The size in bytes, or `null`.
	 */
	size(): number | null {
		if (!fs.existsSync(this.path)) return null;
		return fs.statSync(this.path).size;
	}

	/**
	 * Copies the file to a destination path, creating directories recursively.
	 *
	 * @param dest - Where to copy it.
	 * @returns A handle to the copy, carrying this handle's fallback extension.
	 */
	copyTo(dest: string): XFile {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/**
	 * Moves (renames) the file to a destination path, creating directories recursively.
	 *
	 * @param dest - Where to move it.
	 * @returns A handle to the new location. This handle still points at the old
	 * path, which no longer exists.
	 */
	moveTo(dest: string): XFile {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.renameSync(this.path, dest);
		return new XFile(dest, this.fallbackExtension);
	}

	/**
	 * Appends data to the file.
	 *
	 * @param data - The contents to add at the end. Unlike {@link XFile.write},
	 * parent directories are not created.
	 */
	append(data: string | Uint8Array): void {
		fs.appendFileSync(this.path, data);
	}

	/**
	 * Returns a new XFile pointing to a sibling path (same directory, different name).
	 *
	 * @param filename - The sibling's full name, extension included.
	 * @returns A handle to the sibling. Nothing is created on disk.
	 */
	sibling(filename: string): XFile {
		return new XFile(path.join(path.dirname(this.path), filename), this.fallbackExtension);
	}

	/**
	 * Returns a new XFile with a different extension.
	 *
	 * @param ext - The new extension, without the leading dot.
	 * @returns A handle to the renamed path. Nothing is moved on disk.
	 */
	withExtension(ext: string): XFile {
		return new XFile(
			path.join(path.dirname(this.path), this.concat(this.name, this.DOT, ext)),
			this.fallbackExtension,
		);
	}

	/**
	 * The absolute directory path containing this file.
	 *
	 * @returns The directory path.
	 */
	get dir(): string {
		return path.dirname(this.path);
	}

	/**
	 * The name of the file without the extension.
	 *
	 * @returns The bare name.
	 */
	get name(): string {
		const last = this.path.split(this.SEP).pop() ?? this.path;
		return last.replace(this.concat(this.DOT, this.extension), this.EMPTY);
	}

	/**
	 * The file extension (e.g., "html", "md"), excluding the leading dot.
	 *
	 * @returns The lowercased extension, or the fallback extension when the name
	 * has none.
	 */
	get extension(): string {
		const last = this.path.split(this.SEP).pop() ?? this.EMPTY;
		if (!last.includes(this.DOT)) return this.fallbackExtension.toLowerCase();
		const ext = last.split(this.DOT).pop() ?? this.fallbackExtension;
		return ext.toLowerCase();
	}

	/**
	 * The full name of the file, including the extension.
	 *
	 * @returns The name with its extension. This is what the file-serving routes
	 * send as the `Content-Disposition` filename.
	 */
	get fullname(): string {
		return this.concat(this.name, this.DOT, this.extension);
	}

	/**
	 * Gets the parent directory names as an array, ordered from the immediate parent up to the root.
	 *
	 * @returns The directory names, nearest first. Empty segments are dropped, so
	 * a leading or doubled separator does not produce blanks.
	 */
	get parentDirs(): string[] {
		const parts = this.path.split(this.SEP);
		parts.pop();
		return parts.filter((seg) => seg.length > 0).reverse();
	}

	/**
	 * The standard MIME type associated with the file's extension.
	 *
	 * Resolved from the extension alone — the file's contents are never read, and
	 * it need not exist. Any parameters such as `charset` are stripped, so the
	 * result is safe to use as a bare `Content-Type`.
	 *
	 * @returns The MIME type, or `"application/octet-stream"` when the extension
	 * maps to nothing known.
	 */
	get mimeType(): string {
		const type = Bun.file(`file.${this.extension}`).type;
		if (!type || type === "application/octet-stream") return "application/octet-stream";
		return type.split(";")[0]?.trim() ?? "application/octet-stream";
	}
}

export { XFile };

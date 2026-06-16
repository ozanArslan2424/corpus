export abstract class XFileAbstract {
	constructor(
		/** The path of the file. */
		readonly path: string,
		/** Fallback extension for extension-less files, defaults to "txt" */
		private readonly fallbackExtension: string = "txt",
	) {}

	private readonly SLASH = "/";
	private readonly DOT = ".";
	private readonly EMPTY = "";
	private readonly concat = (...parts: string[]) => parts.join(this.EMPTY);

	/**
	 * Reads the file content and returns it as a string.
	 * @param encoding defaults to "utf8"
	 */
	abstract text(): Promise<string>;

	/** Opens a readable stream to the file's content. */
	abstract stream(): Promise<ReadableStream<Uint8Array>>;

	/** Checks if the file exists in the file system. */
	abstract exists(): Promise<boolean>;

	/** Writes to the file, directories are created recursively. */
	abstract write(data: string | ArrayBuffer): Promise<void>;

	/** Deletes the file. */
	abstract unlink(): Promise<void>;

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
		const mimeTypes: Record<string, string> = {
			html: "text/html",
			htm: "text/html",
			css: "text/css",
			js: "application/javascript",
			ts: "application/javascript",
			mjs: "application/javascript",
			json: "application/json",
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			svg: "image/svg+xml",
			ico: "image/x-icon",
			txt: "text/plain",
			xml: "application/xml",
			pdf: "application/pdf",
			zip: "application/zip",
			mp3: "audio/mpeg",
			mp4: "video/mp4",
			webm: "video/webm",
			woff: "font/woff",
			woff2: "font/woff2",
			ttf: "font/ttf",
		};

		return mimeTypes[this.extension] ?? "application/octet-stream";
	}
}

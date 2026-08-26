import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { X } from "#corpus";

describe("X.File", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "xfile-test-"));
	});

	afterAll(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	const writeFile = async (name: string, contents: string): Promise<string> => {
		const filePath = path.join(tmpDir, name);
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, contents, "utf8");
		return filePath;
	};

	describe("getters", () => {
		it("extension - from path", () => {
			expect(new X.File("assets/document.txt").extension).toBe("txt");
		});

		it("extension - fallback when no dot", () => {
			expect(new X.File("assets/data", "json").extension).toBe("json");
		});

		it("extension - default to txt when no dot and no fallback", () => {
			expect(new X.File("assets/data").extension).toBe("txt");
		});

		it("name - strips extension", () => {
			expect(new X.File("assets/document.txt").name).toBe("document");
		});

		it("name - handles path with no directory", () => {
			expect(new X.File("readme.md").name).toBe("readme");
		});

		it("fullname - includes extension", () => {
			expect(new X.File("assets/document.txt").fullname).toBe("document.txt");
		});

		it("dir - returns parent directory", () => {
			expect(new X.File("assets/sub/document.txt").dir).toBe("assets/sub");
		});

		it("dir - root level file", () => {
			expect(new X.File("document.txt").dir).toBe(".");
		});

		it("parent_dirs - ordered immediate to root", () => {
			expect(new X.File("a/b/c/file.txt").parentDirs).toEqual(["c", "b", "a"]);
		});

		it("parent_dirs - empty for root-level file", () => {
			expect(new X.File("file.txt").parentDirs).toEqual([]);
		});

		it("parent_dirs - filters empty segments from leading slash", () => {
			expect(new X.File("/a/b/file.txt").parentDirs).toEqual(["b", "a"]);
		});
	});

	describe("mimeType", () => {
		it("known extensions", () => {
			expect(new X.File("a.html").mimeType).toInclude("text/html");
			expect(new X.File("a.css").mimeType).toInclude("text/css");
			expect(new X.File("a.js").mimeType).toInclude("text/javascript");
			expect(new X.File("a.json").mimeType).toInclude("application/json");
			expect(new X.File("a.png").mimeType).toInclude("image/png");
			expect(new X.File("a.webp").mimeType).toInclude("image/webp");
			expect(new X.File("a.svg").mimeType).toInclude("image/svg+xml");
			expect(new X.File("a.pdf").mimeType).toInclude("application/pdf");
			expect(new X.File("a.mp4").mimeType).toInclude("video/mp4");
			expect(new X.File("a.mp3").mimeType).toInclude("audio/mpeg");
			expect(new X.File("a.woff2").mimeType).toInclude("font/woff2");
			expect(new X.File("a.xyz").mimeType).toBe("chemical/x-xyz");
		});

		it("unknown extension falls back to octet-stream", () => {
			expect(new X.File("a.what").mimeType).toBe("application/octet-stream");
		});

		it("uses fallback extension when path has none", () => {
			expect(new X.File("data", "json").mimeType).toBe("application/json");
		});
	});

	describe("sibling", () => {
		it("returns file in same directory", () => {
			const file = new X.File("assets/sub/document.txt");
			expect(file.sibling("other.txt").path).toBe(path.join("assets/sub", "other.txt"));
		});

		it("inherits fallback extension", () => {
			const file = new X.File("assets/data", "json");
			// @ts-expect-error
			expect(file.sibling("other").fallbackExtension).toBe("json");
		});
	});

	describe("withExtension", () => {
		it("returns file with new extension", () => {
			const file = new X.File("assets/document.txt");
			expect(file.withExtension("md").fullname).toBe("document.md");
		});

		it("stays in same directory", () => {
			const file = new X.File("assets/sub/document.txt");
			expect(file.withExtension("html").dir).toBe(file.dir);
		});
	});

	describe("exists", () => {
		it("returns true for existing file", async () => {
			const file = new X.File(await writeFile("present.txt", "hello"));
			expect(await file.exists()).toBeTrue();
		});

		it("returns false for missing file", async () => {
			expect(await new X.File(path.join(tmpDir, "missing.txt")).exists()).toBeFalse();
		});
	});

	describe("text", () => {
		it("reads utf8 by default", async () => {
			const file = new X.File(await writeFile("text.txt", "hello world"));
			expect(await file.text()).toBe("hello world");
		});

		it("reads non-ascii content", async () => {
			const file = new X.File(await writeFile("unicode.txt", "merhaba 🌍"));
			expect(await file.text()).toBe("merhaba 🌍");
		});

		it("reads empty file", async () => {
			const file = new X.File(await writeFile("empty.txt", ""));
			expect(await file.text()).toBe("");
		});

		it("throws when file missing", () => {
			expect(new X.File(path.join(tmpDir, "nope.txt")).text()).rejects.toThrow();
		});
	});

	describe("bytes", () => {
		it("returns uint8array", async () => {
			const file = new X.File(await writeFile("bytes.txt", "hello"));
			expect(await file.bytes()).toBeInstanceOf(Uint8Array);
		});

		it("content matches file", async () => {
			const filePath = path.join(tmpDir, "bytes-bin.bin");
			const data = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
			await fs.writeFile(filePath, data);
			expect(await new X.File(filePath).bytes()).toEqual(data);
		});

		it("throws when file missing", () => {
			expect(new X.File(path.join(tmpDir, "nope.bin")).bytes()).rejects.toThrow();
		});
	});

	describe("stream", () => {
		it("returns a readable stream", async () => {
			const file = new X.File(await writeFile("stream.txt", "streamed contents"));
			expect(await file.stream()).toBeInstanceOf(ReadableStream);
		});

		it("stream contents match file contents", async () => {
			const contents = "streamed contents";
			const file = new X.File(await writeFile("stream-read.txt", contents));
			const text = await new Response(await file.stream()).text();
			expect(text).toBe(contents);
		});

		it("handles binary content", async () => {
			const filePath = path.join(tmpDir, "binary.bin");
			const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
			await fs.writeFile(filePath, bytes);
			const buffer = await new Response(await new X.File(filePath).stream()).arrayBuffer();
			expect(new Uint8Array(buffer)).toEqual(bytes);
		});

		it("handles empty file", async () => {
			const file = new X.File(await writeFile("empty-stream.txt", ""));
			expect(await new Response(await file.stream()).text()).toBe("");
		});

		it("throws when file missing", async () => {
			const file = new X.File(path.join(tmpDir, "missing-stream.txt"));
			expect(file.stream()).resolves.toThrow();
		});
	});

	describe("stat", () => {
		it("returns stats object", async () => {
			const file = new X.File(await writeFile("stat.txt", "data"));
			const s = await file.stat();
			expect(s.isFile()).toBeTrue();
		});

		it("size matches content length", async () => {
			const content = "hello world";
			const file = new X.File(await writeFile("stat-size.txt", content));
			const s = await file.stat();
			expect(s.size).toBe(Buffer.byteLength(content, "utf8"));
		});

		it("throws when file missing", () => {
			expect(new X.File(path.join(tmpDir, "missing-stat.txt")).stat()).rejects.toThrow();
		});
	});

	describe("size", () => {
		it("returns size in bytes", async () => {
			const content = "hello";
			const file = new X.File(await writeFile("size.txt", content));
			expect(await file.size()).toBe(Buffer.byteLength(content, "utf8"));
		});

		it("returns null for missing file", async () => {
			expect(await new X.File(path.join(tmpDir, "missing-size.txt")).size()).toBeNull();
		});
	});

	describe("write", () => {
		it("writes string content", async () => {
			const filePath = path.join(tmpDir, "written.txt");
			await new X.File(filePath).write("hello world");
			expect(await fs.readFile(filePath, "utf8")).toBe("hello world");
		});

		it("writes uint8array content", async () => {
			const filePath = path.join(tmpDir, "written.bin");
			const bytes = new Uint8Array([0x00, 0x01, 0xff]);
			await new X.File(filePath).write(bytes);
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(bytes);
		});

		it("writes arraybuffer content", async () => {
			const filePath = path.join(tmpDir, "written-ab.bin");
			const buffer = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
			await new X.File(filePath).write(buffer);
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(new Uint8Array(buffer));
		});

		it("overwrites existing file", async () => {
			const file = new X.File(await writeFile("overwrite.txt", "original"));
			await file.write("replaced");
			expect(await file.text()).toBe("replaced");
		});

		it("creates parent directories", async () => {
			const filePath = path.join(tmpDir, "nested", "deeply", "file.txt");
			await new X.File(filePath).write("nested content");
			expect(await fs.readFile(filePath, "utf8")).toBe("nested content");
		});

		it("writes empty string", async () => {
			const filePath = path.join(tmpDir, "empty-write.txt");
			await new X.File(filePath).write("");
			expect(await fs.readFile(filePath, "utf8")).toBe("");
		});

		it("round-trips through text()", async () => {
			const filePath = path.join(tmpDir, "roundtrip.txt");
			const file = new X.File(filePath);
			await file.write("merhaba 🌍");
			expect(await file.text()).toBe("merhaba 🌍");
		});
	});

	describe("append", () => {
		it("appends to existing file", async () => {
			const file = new X.File(await writeFile("append.txt", "hello"));
			await file.append(" world");
			expect(await file.text()).toBe("hello world");
		});

		it("appends uint8array", async () => {
			const filePath = path.join(tmpDir, "append-bin.bin");
			await fs.writeFile(filePath, new Uint8Array([0x01]));
			await new X.File(filePath).append(new Uint8Array([0x02]));
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(new Uint8Array([0x01, 0x02]));
		});

		it("multiple appends accumulate", async () => {
			const file = new X.File(await writeFile("multi-append.txt", "a"));
			await file.append("b");
			await file.append("c");
			expect(await file.text()).toBe("abc");
		});
	});

	describe("copyTo", () => {
		it("creates a copy at destination", async () => {
			const file = new X.File(await writeFile("copy-src.txt", "copy me"));
			const dest = path.join(tmpDir, "copy-dest.txt");
			await file.copyTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("copy me");
		});

		it("original still exists", async () => {
			const file = new X.File(await writeFile("copy-original.txt", "still here"));
			await file.copyTo(path.join(tmpDir, "copy-original-dest.txt"));
			expect(await file.exists()).toBeTrue();
		});

		it("returns xfile pointing to destination", async () => {
			const file = new X.File(await writeFile("copy-ret.txt", "data"));
			const dest = path.join(tmpDir, "copy-ret-dest.txt");
			const result = await file.copyTo(dest);
			expect(result.path).toBe(dest);
			expect(await result.text()).toBe("data");
		});

		it("creates parent directories", async () => {
			const file = new X.File(await writeFile("copy-mkdir.txt", "data"));
			const dest = path.join(tmpDir, "copy-nested", "dir", "file.txt");
			await file.copyTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("data");
		});
	});

	describe("moveTo", () => {
		it("file exists at destination", async () => {
			const file = new X.File(await writeFile("move-src.txt", "move me"));
			const dest = path.join(tmpDir, "move-dest.txt");
			await file.moveTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("move me");
		});

		it("original no longer exists", async () => {
			const srcPath = await writeFile("move-gone.txt", "bye");
			const file = new X.File(srcPath);
			await file.moveTo(path.join(tmpDir, "move-gone-dest.txt"));
			expect(await fs.exists(srcPath)).toBeFalse();
		});

		it("returns xfile pointing to destination", async () => {
			const file = new X.File(await writeFile("move-ret.txt", "data"));
			const dest = path.join(tmpDir, "move-ret-dest.txt");
			const result = await file.moveTo(dest);
			expect(result.path).toBe(dest);
			expect(await result.text()).toBe("data");
		});

		it("creates parent directories", async () => {
			const file = new X.File(await writeFile("move-mkdir.txt", "data"));
			const dest = path.join(tmpDir, "move-nested", "dir", "file.txt");
			await file.moveTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("data");
		});
	});

	describe("unlink", () => {
		it("removes existing file", async () => {
			const filePath = await writeFile("to-delete.txt", "bye");
			const file = new X.File(filePath);
			await file.unlink();
			expect(await fs.exists(filePath)).toBeFalse();
		});

		it("throws when file missing", () => {
			expect(new X.File(path.join(tmpDir, "never-existed.txt")).unlink()).rejects.toThrow();
		});

		it("exists returns false after unlink", async () => {
			const file = new X.File(await writeFile("check-after.txt", "data"));
			expect(await file.exists()).toBeTrue();
			await file.unlink();
			expect(await file.exists()).toBeFalse();
		});

		it("write after unlink recreates file", async () => {
			const file = new X.File(await writeFile("recreate.txt", "first"));
			await file.unlink();
			await file.write("second");
			expect(await file.text()).toBe("second");
		});
	});

	describe("fromBunFile", () => {
		it("accepts bunfile as input", async () => {
			const filePath = await writeFile("bunfile.txt", "from bun");
			const file = new X.File(Bun.file(filePath));
			expect(await file.text()).toBe("from bun");
		});

		it("path is derived from bunfile name", async () => {
			const filePath = await writeFile("bunfile-path.txt", "data");
			const file = new X.File(Bun.file(filePath));
			expect(file.path).toBe(filePath);
		});

		it("extension is derived from bunfile path", async () => {
			const filePath = await writeFile("bunfile-ext.json", "{}");
			const file = new X.File(Bun.file(filePath));
			expect(file.extension).toBe("json");
		});

		it("mimetype is correct from bunfile", async () => {
			const filePath = await writeFile("bunfile-mime.png", "");
			const file = new X.File(Bun.file(filePath));
			expect(file.mimeType).toInclude("image/png");
		});

		it("exists works from bunfile", async () => {
			const filePath = await writeFile("bunfile-exists.txt", "hi");
			expect(await new X.File(Bun.file(filePath)).exists()).toBeTrue();
		});

		it("missing bunfile returns false for exists", async () => {
			expect(
				await new X.File(Bun.file(path.join(tmpDir, "bunfile-missing.txt"))).exists(),
			).toBeFalse();
		});

		it("write and read round-trips from bunfile", async () => {
			const filePath = path.join(tmpDir, "bunfile-roundtrip.txt");
			const file = new X.File(Bun.file(filePath));
			await file.write("round trip");
			expect(await file.text()).toBe("round trip");
		});

		it("fallback extension still applies from bunfile with no extension", async () => {
			const filePath = path.join(tmpDir, "bunfile-noext");
			await fs.writeFile(filePath, "data");
			const file = new X.File(Bun.file(filePath), "json");
			expect(file.extension).toBe("json");
		});
	});
});

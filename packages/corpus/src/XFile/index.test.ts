import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { XFile } from "@/XFile";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "xfile-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(relPath: string, content: string): string {
	const full = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content);
	return full;
}

describe("XFile", () => {
	describe("constructor", () => {
		it("accepts a string path", () => {
			const full = writeFixture("hello.txt", "hi");
			const file = new XFile(full);
			expect(file.path).toBe(full);
		});

		it("accepts a Bun.BunFile", () => {
			const full = writeFixture("hello.txt", "hi");
			const bunFile = Bun.file(full);
			const file = new XFile(bunFile);
			expect(file.path).toBe(bunFile.name as string);
			expect(file.bunFile).toBe(bunFile);
		});
	});

	describe("text / bytes", () => {
		it("reads file content as a string", () => {
			const full = writeFixture("hello.txt", "hello world");
			expect(new XFile(full).text()).toBe("hello world");
		});

		it("reads file content as bytes", () => {
			const full = writeFixture("hello.txt", "hi");
			const bytes = new XFile(full).bytes();
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(Buffer.from(bytes).toString()).toBe("hi");
		});
	});

	describe("stream", () => {
		it("returns a readable stream of the file's content", async () => {
			const full = writeFixture("hello.txt", "streamed content");
			const stream = new XFile(full).stream();
			const chunks: Uint8Array[] = [];
			for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
				chunks.push(chunk);
			}
			expect(Buffer.concat(chunks).toString()).toBe("streamed content");
		});
	});

	describe("exists / size", () => {
		it("returns true and the byte size for an existing file", () => {
			const full = writeFixture("hello.txt", "12345");
			const file = new XFile(full);
			expect(file.exists()).toBe(true);
			expect(file.size()).toBe(5);
		});

		it("returns false and null for a nonexistent file", () => {
			const file = new XFile(path.join(tmpDir, "missing.txt"));
			expect(file.exists()).toBe(false);
			expect(file.size()).toBeNull();
		});

		it("reflects unlink immediately, unlike a cached BunFile check", () => {
			const full = writeFixture("hello.txt", "content");
			const file = new XFile(full);
			expect(file.exists()).toBe(true);
			file.unlink();
			expect(file.exists()).toBe(false);
		});
	});

	describe("write", () => {
		it("writes string data to a new file", () => {
			const full = path.join(tmpDir, "new.txt");
			new XFile(full).write("some content");
			expect(fs.readFileSync(full, "utf8")).toBe("some content");
		});

		it("creates parent directories recursively", () => {
			const full = path.join(tmpDir, "a", "b", "c", "new.txt");
			new XFile(full).write("nested");
			expect(fs.readFileSync(full, "utf8")).toBe("nested");
		});

		it("writes ArrayBuffer data", () => {
			const full = path.join(tmpDir, "buf.bin");
			const buf = new TextEncoder().encode("array buffer content").buffer;
			new XFile(full).write(buf);
			expect(fs.readFileSync(full, "utf8")).toBe("array buffer content");
		});

		it("writes Uint8Array data", () => {
			const full = path.join(tmpDir, "u8.bin");
			new XFile(full).write(new TextEncoder().encode("uint8 content"));
			expect(fs.readFileSync(full, "utf8")).toBe("uint8 content");
		});

		it("overwrites existing content", () => {
			const full = writeFixture("existing.txt", "old");
			new XFile(full).write("new");
			expect(fs.readFileSync(full, "utf8")).toBe("new");
		});
	});

	describe("append", () => {
		it("appends string data to an existing file", () => {
			const full = writeFixture("log.txt", "line1\n");
			new XFile(full).append("line2\n");
			expect(fs.readFileSync(full, "utf8")).toBe("line1\nline2\n");
		});

		it("appends Uint8Array data", () => {
			const full = writeFixture("log.txt", "line1\n");
			new XFile(full).append(new TextEncoder().encode("line2\n"));
			expect(fs.readFileSync(full, "utf8")).toBe("line1\nline2\n");
		});
	});

	describe("unlink", () => {
		it("removes the file from disk", () => {
			const full = writeFixture("gone.txt", "bye");
			new XFile(full).unlink();
			expect(fs.existsSync(full)).toBe(false);
		});
	});

	describe("stat", () => {
		it("returns fs.Stats for the file", () => {
			const full = writeFixture("hello.txt", "hi");
			const stats = new XFile(full).stat();
			expect(stats.isFile()).toBe(true);
			expect(stats.size).toBe(2);
		});
	});

	describe("copyTo", () => {
		it("copies the file content to a new path", () => {
			const src = writeFixture("src.txt", "copy me");
			const dest = path.join(tmpDir, "dest.txt");
			new XFile(src).copyTo(dest);
			expect(fs.readFileSync(dest, "utf8")).toBe("copy me");
			expect(fs.existsSync(src)).toBe(true);
		});

		it("creates destination directories recursively", () => {
			const src = writeFixture("src.txt", "copy me");
			const dest = path.join(tmpDir, "a", "b", "dest.txt");
			new XFile(src).copyTo(dest);
			expect(fs.readFileSync(dest, "utf8")).toBe("copy me");
		});

		it("returns a new XFile pointing to the destination", () => {
			const src = writeFixture("src.txt", "copy me");
			const dest = path.join(tmpDir, "dest.txt");
			const result = new XFile(src).copyTo(dest);
			expect(result.path).toBe(dest);
		});

		it("preserves the fallback extension on the returned XFile", () => {
			const src = writeFixture("src", "copy me");
			const dest = path.join(tmpDir, "dest");
			const result = new XFile(src, "md").copyTo(dest);
			expect(result.extension).toBe("md");
		});
	});

	describe("moveTo", () => {
		it("moves the file content to a new path and removes the original", () => {
			const src = writeFixture("src.txt", "move me");
			const dest = path.join(tmpDir, "dest.txt");
			new XFile(src).moveTo(dest);
			expect(fs.readFileSync(dest, "utf8")).toBe("move me");
			expect(fs.existsSync(src)).toBe(false);
		});

		it("creates destination directories recursively", () => {
			const src = writeFixture("src.txt", "move me");
			const dest = path.join(tmpDir, "a", "b", "dest.txt");
			new XFile(src).moveTo(dest);
			expect(fs.readFileSync(dest, "utf8")).toBe("move me");
		});

		it("returns a new XFile pointing to the destination", () => {
			const src = writeFixture("src.txt", "move me");
			const dest = path.join(tmpDir, "dest.txt");
			const result = new XFile(src).moveTo(dest);
			expect(result.path).toBe(dest);
		});
	});

	describe("sibling", () => {
		it("returns a new XFile in the same directory with a different name", () => {
			const full = path.join(tmpDir, "sub", "original.txt");
			const file = new XFile(full);
			const sib = file.sibling("other.md");
			expect(sib.path).toBe(path.join(tmpDir, "sub", "other.md"));
		});

		it("preserves the fallback extension", () => {
			const file = new XFile(path.join(tmpDir, "original.txt"), "md");
			const sib = file.sibling("noext");
			expect(sib.extension).toBe("md");
		});
	});

	describe("withExtension", () => {
		it("returns a new XFile with the same name but a different extension", () => {
			const file = new XFile(path.join(tmpDir, "report.txt"));
			const result = file.withExtension("md");
			expect(result.path).toBe(path.join(tmpDir, "report.md"));
		});
	});

	describe("dir", () => {
		it("returns the directory containing the file", () => {
			const full = path.join(tmpDir, "sub", "file.txt");
			expect(new XFile(full).dir).toBe(path.join(tmpDir, "sub"));
		});
	});

	describe("name", () => {
		it("returns the filename without its extension", () => {
			expect(new XFile(path.join(tmpDir, "report.txt")).name).toBe("report");
		});

		it("handles filenames with multiple dots", () => {
			expect(new XFile(path.join(tmpDir, "archive.tar.gz")).name).toBe("archive.tar");
		});

		it("returns the full filename when there is no extension", () => {
			expect(new XFile(path.join(tmpDir, "README")).name).toBe("README");
		});
	});

	describe("extension", () => {
		it("returns the lowercase extension without the leading dot", () => {
			expect(new XFile(path.join(tmpDir, "report.TXT")).extension).toBe("txt");
		});

		it("falls back to the fallback extension when there is none", () => {
			expect(new XFile(path.join(tmpDir, "README"), "md").extension).toBe("md");
		});

		it("lowercases a custom fallback extension", () => {
			expect(new XFile(path.join(tmpDir, "README"), "MD").extension).toBe("md");
		});

		it("defaults the fallback extension to txt", () => {
			expect(new XFile(path.join(tmpDir, "README")).extension).toBe("txt");
		});
	});

	describe("fullname", () => {
		it("combines name and extension", () => {
			expect(new XFile(path.join(tmpDir, "report.txt")).fullname).toBe("report.txt");
		});

		it("appends the fallback extension for extension-less files", () => {
			expect(new XFile(path.join(tmpDir, "README"), "md").fullname).toBe("README.md");
		});
	});

	describe("parentDirs", () => {
		it("lists parent directories from immediate parent up to root", () => {
			const full = path.join("/a/b/c", "file.txt");
			expect(new XFile(full).parentDirs).toEqual(["c", "b", "a"]);
		});

		it("handles backslash-separated (Windows-style) paths", () => {
			const full = "C:\\a\\b\\c\\file.txt";
			expect(new XFile(full).parentDirs).toEqual(["c", "b", "a", "C:"]);
		});

		it("returns an empty array for a file with no parent segments", () => {
			expect(new XFile("file.txt").parentDirs).toEqual([]);
		});
	});

	describe("mimeType", () => {
		it("returns the correct mime type for a known extension", () => {
			expect(new XFile(path.join(tmpDir, "page.html")).mimeType).toBe("text/html");
		});

		it("returns the correct mime type for json", () => {
			expect(new XFile(path.join(tmpDir, "data.json")).mimeType).toBe("application/json");
		});

		it("falls back to application/octet-stream for an unrecognized extension", () => {
			expect(new XFile(path.join(tmpDir, "file.unknownext")).mimeType).toBe(
				"application/octet-stream",
			);
		});
	});
});

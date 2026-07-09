import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { TX } from "../_modules";

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
		it("EXTENSION - FROM PATH", () => {
			expect(new TX.File("assets/document.txt").extension).toBe("txt");
		});

		it("EXTENSION - FALLBACK WHEN NO DOT", () => {
			expect(new TX.File("assets/data", "json").extension).toBe("json");
		});

		it("EXTENSION - DEFAULT TO TXT WHEN NO DOT AND NO FALLBACK", () => {
			expect(new TX.File("assets/data").extension).toBe("txt");
		});

		it("NAME - STRIPS EXTENSION", () => {
			expect(new TX.File("assets/document.txt").name).toBe("document");
		});

		it("NAME - HANDLES PATH WITH NO DIRECTORY", () => {
			expect(new TX.File("readme.md").name).toBe("readme");
		});

		it("FULLNAME - INCLUDES EXTENSION", () => {
			expect(new TX.File("assets/document.txt").fullname).toBe("document.txt");
		});

		it("DIR - RETURNS PARENT DIRECTORY", () => {
			expect(new TX.File("assets/sub/document.txt").dir).toBe("assets/sub");
		});

		it("DIR - ROOT LEVEL FILE", () => {
			expect(new TX.File("document.txt").dir).toBe(".");
		});

		it("PARENT_DIRS - ORDERED IMMEDIATE TO ROOT", () => {
			expect(new TX.File("a/b/c/file.txt").parentDirs).toEqual(["c", "b", "a"]);
		});

		it("PARENT_DIRS - EMPTY FOR ROOT-LEVEL FILE", () => {
			expect(new TX.File("file.txt").parentDirs).toEqual([]);
		});

		it("PARENT_DIRS - FILTERS EMPTY SEGMENTS FROM LEADING SLASH", () => {
			expect(new TX.File("/a/b/file.txt").parentDirs).toEqual(["b", "a"]);
		});
	});

	describe("mimeType", () => {
		it("KNOWN EXTENSIONS", () => {
			expect(new TX.File("a.html").mimeType).toInclude("text/html");
			expect(new TX.File("a.css").mimeType).toInclude("text/css");
			expect(new TX.File("a.js").mimeType).toInclude("text/javascript");
			expect(new TX.File("a.json").mimeType).toInclude("application/json");
			expect(new TX.File("a.png").mimeType).toInclude("image/png");
			expect(new TX.File("a.webp").mimeType).toInclude("image/webp");
			expect(new TX.File("a.svg").mimeType).toInclude("image/svg+xml");
			expect(new TX.File("a.pdf").mimeType).toInclude("application/pdf");
			expect(new TX.File("a.mp4").mimeType).toInclude("video/mp4");
			expect(new TX.File("a.mp3").mimeType).toInclude("audio/mpeg");
			expect(new TX.File("a.woff2").mimeType).toInclude("font/woff2");
			expect(new TX.File("a.xyz").mimeType).toBe("chemical/x-xyz");
		});

		it("UNKNOWN EXTENSION FALLS BACK TO OCTET-STREAM", () => {
			expect(new TX.File("a.what").mimeType).toBe("application/octet-stream");
		});

		it("USES FALLBACK EXTENSION WHEN PATH HAS NONE", () => {
			expect(new TX.File("data", "json").mimeType).toBe("application/json");
		});
	});

	describe("sibling", () => {
		it("RETURNS FILE IN SAME DIRECTORY", () => {
			const file = new TX.File("assets/sub/document.txt");
			expect(file.sibling("other.txt").path).toBe(path.join("assets/sub", "other.txt"));
		});

		it("INHERITS FALLBACK EXTENSION", () => {
			const file = new TX.File("assets/data", "json");
			// @ts-expect-error
			expect(file.sibling("other").fallbackExtension).toBe("json");
		});
	});

	describe("withExtension", () => {
		it("RETURNS FILE WITH NEW EXTENSION", () => {
			const file = new TX.File("assets/document.txt");
			expect(file.withExtension("md").fullname).toBe("document.md");
		});

		it("STAYS IN SAME DIRECTORY", () => {
			const file = new TX.File("assets/sub/document.txt");
			expect(file.withExtension("html").dir).toBe(file.dir);
		});
	});

	describe("exists", () => {
		it("RETURNS TRUE FOR EXISTING FILE", async () => {
			const file = new TX.File(await writeFile("present.txt", "hello"));
			expect(await file.exists()).toBeTrue();
		});

		it("RETURNS FALSE FOR MISSING FILE", async () => {
			expect(await new TX.File(path.join(tmpDir, "missing.txt")).exists()).toBeFalse();
		});
	});

	describe("text", () => {
		it("READS UTF8 BY DEFAULT", async () => {
			const file = new TX.File(await writeFile("text.txt", "hello world"));
			expect(await file.text()).toBe("hello world");
		});

		it("READS NON-ASCII CONTENT", async () => {
			const file = new TX.File(await writeFile("unicode.txt", "merhaba 🌍"));
			expect(await file.text()).toBe("merhaba 🌍");
		});

		it("READS EMPTY FILE", async () => {
			const file = new TX.File(await writeFile("empty.txt", ""));
			expect(await file.text()).toBe("");
		});

		it("THROWS WHEN FILE MISSING", () => {
			expect(new TX.File(path.join(tmpDir, "nope.txt")).text()).rejects.toThrow();
		});
	});

	describe("bytes", () => {
		it("RETURNS UINT8ARRAY", async () => {
			const file = new TX.File(await writeFile("bytes.txt", "hello"));
			expect(await file.bytes()).toBeInstanceOf(Uint8Array);
		});

		it("CONTENT MATCHES FILE", async () => {
			const filePath = path.join(tmpDir, "bytes-bin.bin");
			const data = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
			await fs.writeFile(filePath, data);
			expect(await new TX.File(filePath).bytes()).toEqual(data);
		});

		it("THROWS WHEN FILE MISSING", () => {
			expect(new TX.File(path.join(tmpDir, "nope.bin")).bytes()).rejects.toThrow();
		});
	});

	describe("stream", () => {
		it("RETURNS A READABLE STREAM", async () => {
			const file = new TX.File(await writeFile("stream.txt", "streamed contents"));
			expect(await file.stream()).toBeInstanceOf(ReadableStream);
		});

		it("STREAM CONTENTS MATCH FILE CONTENTS", async () => {
			const contents = "streamed contents";
			const file = new TX.File(await writeFile("stream-read.txt", contents));
			const text = await new Response(await file.stream()).text();
			expect(text).toBe(contents);
		});

		it("HANDLES BINARY CONTENT", async () => {
			const filePath = path.join(tmpDir, "binary.bin");
			const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
			await fs.writeFile(filePath, bytes);
			const buffer = await new Response(await new TX.File(filePath).stream()).arrayBuffer();
			expect(new Uint8Array(buffer)).toEqual(bytes);
		});

		it("HANDLES EMPTY FILE", async () => {
			const file = new TX.File(await writeFile("empty-stream.txt", ""));
			expect(await new Response(await file.stream()).text()).toBe("");
		});

		it("THROWS WHEN FILE MISSING", async () => {
			const file = new TX.File(path.join(tmpDir, "missing-stream.txt"));
			const stream = await file.stream();
			expect(new Response(stream).text()).rejects.toThrow();
		});
	});

	describe("stat", () => {
		it("RETURNS STATS OBJECT", async () => {
			const file = new TX.File(await writeFile("stat.txt", "data"));
			const s = await file.stat();
			expect(s.isFile()).toBeTrue();
		});

		it("SIZE MATCHES CONTENT LENGTH", async () => {
			const content = "hello world";
			const file = new TX.File(await writeFile("stat-size.txt", content));
			const s = await file.stat();
			expect(s.size).toBe(Buffer.byteLength(content, "utf8"));
		});

		it("THROWS WHEN FILE MISSING", () => {
			expect(new TX.File(path.join(tmpDir, "missing-stat.txt")).stat()).rejects.toThrow();
		});
	});

	describe("size", () => {
		it("RETURNS SIZE IN BYTES", async () => {
			const content = "hello";
			const file = new TX.File(await writeFile("size.txt", content));
			expect(await file.size()).toBe(Buffer.byteLength(content, "utf8"));
		});

		it("RETURNS NULL FOR MISSING FILE", async () => {
			expect(await new TX.File(path.join(tmpDir, "missing-size.txt")).size()).toBeNull();
		});
	});

	describe("write", () => {
		it("WRITES STRING CONTENT", async () => {
			const filePath = path.join(tmpDir, "written.txt");
			await new TX.File(filePath).write("hello world");
			expect(await fs.readFile(filePath, "utf8")).toBe("hello world");
		});

		it("WRITES UINT8ARRAY CONTENT", async () => {
			const filePath = path.join(tmpDir, "written.bin");
			const bytes = new Uint8Array([0x00, 0x01, 0xff]);
			await new TX.File(filePath).write(bytes);
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(bytes);
		});

		it("WRITES ARRAYBUFFER CONTENT", async () => {
			const filePath = path.join(tmpDir, "written-ab.bin");
			const buffer = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
			await new TX.File(filePath).write(buffer);
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(new Uint8Array(buffer));
		});

		it("OVERWRITES EXISTING FILE", async () => {
			const file = new TX.File(await writeFile("overwrite.txt", "original"));
			await file.write("replaced");
			expect(await file.text()).toBe("replaced");
		});

		it("CREATES PARENT DIRECTORIES", async () => {
			const filePath = path.join(tmpDir, "nested", "deeply", "file.txt");
			await new TX.File(filePath).write("nested content");
			expect(await fs.readFile(filePath, "utf8")).toBe("nested content");
		});

		it("WRITES EMPTY STRING", async () => {
			const filePath = path.join(tmpDir, "empty-write.txt");
			await new TX.File(filePath).write("");
			expect(await fs.readFile(filePath, "utf8")).toBe("");
		});

		it("ROUND-TRIPS THROUGH TEXT()", async () => {
			const filePath = path.join(tmpDir, "roundtrip.txt");
			const file = new TX.File(filePath);
			await file.write("merhaba 🌍");
			expect(await file.text()).toBe("merhaba 🌍");
		});
	});

	describe("append", () => {
		it("APPENDS TO EXISTING FILE", async () => {
			const file = new TX.File(await writeFile("append.txt", "hello"));
			await file.append(" world");
			expect(await file.text()).toBe("hello world");
		});

		it("APPENDS UINT8ARRAY", async () => {
			const filePath = path.join(tmpDir, "append-bin.bin");
			await fs.writeFile(filePath, new Uint8Array([0x01]));
			await new TX.File(filePath).append(new Uint8Array([0x02]));
			expect(new Uint8Array(await fs.readFile(filePath))).toEqual(new Uint8Array([0x01, 0x02]));
		});

		it("MULTIPLE APPENDS ACCUMULATE", async () => {
			const file = new TX.File(await writeFile("multi-append.txt", "a"));
			await file.append("b");
			await file.append("c");
			expect(await file.text()).toBe("abc");
		});
	});

	describe("copyTo", () => {
		it("CREATES A COPY AT DESTINATION", async () => {
			const file = new TX.File(await writeFile("copy-src.txt", "copy me"));
			const dest = path.join(tmpDir, "copy-dest.txt");
			await file.copyTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("copy me");
		});

		it("ORIGINAL STILL EXISTS", async () => {
			const file = new TX.File(await writeFile("copy-original.txt", "still here"));
			await file.copyTo(path.join(tmpDir, "copy-original-dest.txt"));
			expect(await file.exists()).toBeTrue();
		});

		it("RETURNS XFILE POINTING TO DESTINATION", async () => {
			const file = new TX.File(await writeFile("copy-ret.txt", "data"));
			const dest = path.join(tmpDir, "copy-ret-dest.txt");
			const result = await file.copyTo(dest);
			expect(result.path).toBe(dest);
			expect(await result.text()).toBe("data");
		});

		it("CREATES PARENT DIRECTORIES", async () => {
			const file = new TX.File(await writeFile("copy-mkdir.txt", "data"));
			const dest = path.join(tmpDir, "copy-nested", "dir", "file.txt");
			await file.copyTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("data");
		});
	});

	describe("moveTo", () => {
		it("FILE EXISTS AT DESTINATION", async () => {
			const file = new TX.File(await writeFile("move-src.txt", "move me"));
			const dest = path.join(tmpDir, "move-dest.txt");
			await file.moveTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("move me");
		});

		it("ORIGINAL NO LONGER EXISTS", async () => {
			const srcPath = await writeFile("move-gone.txt", "bye");
			const file = new TX.File(srcPath);
			await file.moveTo(path.join(tmpDir, "move-gone-dest.txt"));
			expect(await fs.exists(srcPath)).toBeFalse();
		});

		it("RETURNS XFILE POINTING TO DESTINATION", async () => {
			const file = new TX.File(await writeFile("move-ret.txt", "data"));
			const dest = path.join(tmpDir, "move-ret-dest.txt");
			const result = await file.moveTo(dest);
			expect(result.path).toBe(dest);
			expect(await result.text()).toBe("data");
		});

		it("CREATES PARENT DIRECTORIES", async () => {
			const file = new TX.File(await writeFile("move-mkdir.txt", "data"));
			const dest = path.join(tmpDir, "move-nested", "dir", "file.txt");
			await file.moveTo(dest);
			expect(await fs.readFile(dest, "utf8")).toBe("data");
		});
	});

	describe("unlink", () => {
		it("REMOVES EXISTING FILE", async () => {
			const filePath = await writeFile("to-delete.txt", "bye");
			const file = new TX.File(filePath);
			await file.unlink();
			expect(await fs.exists(filePath)).toBeFalse();
		});

		it("THROWS WHEN FILE MISSING", () => {
			expect(new TX.File(path.join(tmpDir, "never-existed.txt")).unlink()).rejects.toThrow();
		});

		it("EXISTS RETURNS FALSE AFTER UNLINK", async () => {
			const file = new TX.File(await writeFile("check-after.txt", "data"));
			expect(await file.exists()).toBeTrue();
			await file.unlink();
			expect(await file.exists()).toBeFalse();
		});

		it("WRITE AFTER UNLINK RECREATES FILE", async () => {
			const file = new TX.File(await writeFile("recreate.txt", "first"));
			await file.unlink();
			await file.write("second");
			expect(await file.text()).toBe("second");
		});
	});

	describe("fromBunFile", () => {
		it("ACCEPTS BUNFILE AS INPUT", async () => {
			const filePath = await writeFile("bunfile.txt", "from bun");
			const file = new TX.File(Bun.file(filePath));
			expect(await file.text()).toBe("from bun");
		});

		it("PATH IS DERIVED FROM BUNFILE NAME", async () => {
			const filePath = await writeFile("bunfile-path.txt", "data");
			const file = new TX.File(Bun.file(filePath));
			expect(file.path).toBe(filePath);
		});

		it("EXTENSION IS DERIVED FROM BUNFILE PATH", async () => {
			const filePath = await writeFile("bunfile-ext.json", "{}");
			const file = new TX.File(Bun.file(filePath));
			expect(file.extension).toBe("json");
		});

		it("MIMETYPE IS CORRECT FROM BUNFILE", async () => {
			const filePath = await writeFile("bunfile-mime.png", "");
			const file = new TX.File(Bun.file(filePath));
			expect(file.mimeType).toInclude("image/png");
		});

		it("EXISTS WORKS FROM BUNFILE", async () => {
			const filePath = await writeFile("bunfile-exists.txt", "hi");
			expect(await new TX.File(Bun.file(filePath)).exists()).toBeTrue();
		});

		it("MISSING BUNFILE RETURNS FALSE FOR EXISTS", async () => {
			expect(
				await new TX.File(Bun.file(path.join(tmpDir, "bunfile-missing.txt"))).exists(),
			).toBeFalse();
		});

		it("WRITE AND READ ROUND-TRIPS FROM BUNFILE", async () => {
			const filePath = path.join(tmpDir, "bunfile-roundtrip.txt");
			const file = new TX.File(Bun.file(filePath));
			await file.write("round trip");
			expect(await file.text()).toBe("round trip");
		});

		it("FALLBACK EXTENSION STILL APPLIES FROM BUNFILE WITH NO EXTENSION", async () => {
			const filePath = path.join(tmpDir, "bunfile-noext");
			await fs.writeFile(filePath, "data");
			const file = new TX.File(Bun.file(filePath), "json");
			expect(file.extension).toBe("json");
		});
	});
});

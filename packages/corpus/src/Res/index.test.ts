import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";

import { Cookies } from "@/Cookies";
import { Exception } from "@/Exception";
import { HeaderKey } from "@/Headers";
import { Res, Status } from "@/Res";
import { XFile } from "@/XFile";

let dir: string;
let filePath: string;

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "res-test-"));
	filePath = path.join(dir, "note.txt");
	fs.writeFileSync(filePath, "hello file");
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	return Buffer.concat(chunks).toString();
}

async function readOneChunk(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const { value } = await reader.read();
	return new TextDecoder().decode(value);
}

describe("Res", () => {
	describe("constructor: body parameter", () => {
		it("defaults to null when omitted", () => {
			expect(new Res().body).toBeNull();
		});

		it("defaults to null when explicitly passed undefined", () => {
			expect(new Res(undefined).body).toBeNull();
		});

		it("stores an explicit null as null", () => {
			expect(new Res(null).body).toBeNull();
		});

		it("keeps falsy-but-defined primitives as-is", () => {
			expect(new Res(0).body).toBe(0);
			expect(new Res("").body).toBe("");
			expect(new Res(false).body).toBe(false);
		});

		it("stores a string body as-is", () => {
			expect(new Res("hello").body).toBe("hello");
		});

		it("stores a plain object body as-is, unresolved", () => {
			const data = { a: 1 };
			expect(new Res(data).body).toBe(data);
		});

		it("stores binary body types as-is, unresolved", () => {
			const bytes = new Uint8Array([1, 2, 3]);
			expect(new Res(bytes).body).toBe(bytes);
		});

		it("does not touch headers as a side effect of setting the body", () => {
			// content-type inference only happens in toNativeResponse(), not eagerly
			const res = new Res({ a: 1 });
			expect(res.headers.get(HeaderKey.ContentType)).toBeNull();
		});
	});

	describe("constructor: init parameter", () => {
		it("works with no init argument at all", () => {
			const res = new Res("body");
			expect(res.status).toBe(Status.OK);
			expect(res.statusText).toBe("");
			expect(res.headers).toBeInstanceOf(Headers);
			expect(res.cookies.size).toBe(0);
		});

		it("applies status from init", () => {
			expect(new Res(undefined, { status: Status.CREATED }).status).toBe(Status.CREATED);
		});

		it("applies statusText from init", () => {
			expect(new Res(undefined, { statusText: "Custom!" }).statusText).toBe("Custom!");
		});

		it("wraps a plain headers object from init", () => {
			const res = new Res(undefined, { headers: { "X-Custom": "value" } });
			expect(res.headers.get("X-Custom")).toBe("value");
		});

		it("reuses the exact Headers instance passed via init, rather than copying it", () => {
			const provided = new Headers({ "X-Custom": "1" });
			const res = new Res(undefined, { headers: provided });
			expect(res.headers).toBe(provided);
		});

		it("mutating the originally-provided Headers instance is reflected on res.headers", () => {
			const provided = new Headers();
			const res = new Res(undefined, { headers: provided });
			provided.set("X-Custom", "value");
			expect(res.headers.get("X-Custom")).toBe("value");
		});

		it("uses the CookieMap passed via init.cookies instead of creating a fresh one", () => {
			const provided = new Cookies();
			provided.set("preset", "yes");
			const res = new Res(undefined, { cookies: provided });
			expect(res.cookies.get("preset")).toBe("yes");
		});

		it("immediately reflects cookies provided via init.cookies as Set-Cookie headers, with no further mutation required", () => {
			const provided = new Cookies();
			provided.set("preset", "yes");
			const res = new Res(undefined, { cookies: provided });
			expect(res.headers.get(HeaderKey.SetCookie)).toContain("preset=yes");
		});

		it("is independent per instance - two Res built with no init don't share state", () => {
			const a = new Res();
			const b = new Res();
			a.headers.set("X-A", "1");
			a.cookies.set("name", "a");
			expect(b.headers.get("X-A")).toBeNull();
			expect(b.cookies.get("name")).toBeNull();
		});
	});

	describe("headers", () => {
		it("defaults to an empty Headers instance", () => {
			const res = new Res();
			expect(res.headers).toBeInstanceOf(Headers);
			expect(Object.entries(res.headers.toJSON())).toEqual([]);
		});
	});

	describe("cookies", () => {
		it("defaults to an empty CookieMap", () => {
			expect(new Res().cookies.size).toBe(0);
		});

		it("memoizes the same Cookies instance across repeated access", () => {
			const res = new Res();
			expect(res.cookies).toBe(res.cookies);
		});

		it("adding a cookie is reflected on both the map and the Set-Cookie header", () => {
			const res = new Res();
			res.cookies.set("name", "Ozan");
			expect(res.cookies.get("name")).toBe("Ozan");
			expect(res.headers.get(HeaderKey.SetCookie)).toContain("name=Ozan");
		});

		it("adding multiple cookies produces a Set-Cookie entry for each", () => {
			const res = new Res();
			res.cookies.set("a", "1");
			res.cookies.set("b", "2");
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			expect(header).toContain("a=1");
			expect(header).toContain("b=2");
		});

		it("deleting a cookie issues an expiring Set-Cookie header for it", () => {
			const res = new Res();
			res.cookies.set("name", "Ozan");
			res.cookies.delete("name");
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			expect(header).toContain("name=;");
			expect(header.toLowerCase()).toContain("expires=");
		});
	});

	describe("cookie encoding", () => {
		it("should not re-encode a cookie value on repeated header access", () => {
			const res = new Res("ok");
			res.cookies.set("reflected", "a:b", { path: "/" });

			// the bug needs two reads: onGet writes the map into the header, the
			// patched append parses it back in without decoding, and the next
			// read serializes the already-encoded value again ("%3A" -> "%253A").
			// Cors + toNativeResponse touch headers twice on a real request.
			void res.headers;
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";

			expect(header).toContain("reflected=a%3Ab");
			expect(header).not.toContain("%253A");
		});

		it("should keep a cookie value stable across many header accesses", () => {
			const res = new Res("ok");
			res.cookies.set("session", "a:b c/d", { path: "/" });

			const first = res.headers.get(HeaderKey.SetCookie);
			for (let i = 0; i < 5; i++) void res.headers;

			expect(res.headers.get(HeaderKey.SetCookie)).toBe(first);
		});

		it("should round-trip a cookie value through serialization", () => {
			const value = "a:b c/d";
			const res = new Res("ok");
			res.cookies.set("session", value, { path: "/" });

			void res.headers;
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			const parsed = Bun.Cookie.parse(header);

			expect(decodeURIComponent(parsed.value)).toBe(value);
		});
	});

	describe("cookies + headers: mixed usage", () => {
		it("preserves manually-set headers that are unrelated to cookies", () => {
			const res = new Res();
			res.headers.set("X-Custom", "value");
			res.cookies.set("name", "Ozan");
			expect(res.headers.get("X-Custom")).toBe("value");
			expect(res.headers.get(HeaderKey.SetCookie)).toContain("name=Ozan");
		});

		it("preserves a manually-set Set-Cookie header alongside cookies set via the jar", () => {
			const res = new Res();
			res.headers.append(HeaderKey.SetCookie, "manual=value");
			res.cookies.set("fromJar", "1");
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			expect(header).toContain("manual=value");
			expect(header).toContain("fromJar=1");
		});

		it("does not duplicate a cookie's Set-Cookie entry across repeated reads of headers", () => {
			const res = new Res();
			res.cookies.set("name", "Ozan");
			const first = res.headers.get(HeaderKey.SetCookie);
			const second = res.headers.get(HeaderKey.SetCookie);
			expect(first).toBe(second);
			expect(res.headers.getSetCookie().filter((h) => h.startsWith("name=")).length).toBe(1);
		});

		it("updates only the affected cookie's Set-Cookie entry when one of several cookies changes", () => {
			const res = new Res();
			res.cookies.set("a", "1");
			res.cookies.set("b", "2");
			res.cookies.set("a", "updated");
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			expect(header).toContain("a=updated");
			expect(header).toContain("b=2");
			expect(header).not.toContain("a=1;");
		});

		it("reading cookies via the jar reflects a cookie set directly on headers via fromSetCookieHeaders", () => {
			const res = new Res();
			res.headers.append(HeaderKey.SetCookie, "external=1");
			const parsed = Cookies.fromSetCookieHeaders(res.headers.getSetCookie());
			expect(parsed.get("external")).toBe("1");
		});

		it("constructing with pre-populated init.cookies immediately reflects them in headers", () => {
			const preset = new Cookies();
			preset.set("preexisting", "value");
			const res = new Res(undefined, { cookies: preset });
			expect(res.headers.get(HeaderKey.SetCookie)).toContain("preexisting=value");
			expect(res.cookies.get("preexisting")).toBe("value");
		});

		it("further jar mutations after construction with pre-populated cookies still sync correctly", () => {
			const preset = new Cookies();
			preset.set("preexisting", "value");
			const res = new Res(undefined, { cookies: preset });
			res.cookies.set("new", "one");
			const header = res.headers.get(HeaderKey.SetCookie) ?? "";
			expect(header).toContain("preexisting=value");
			expect(header).toContain("new=one");
		});

		it("setting the same cookie value twice does not produce duplicate Set-Cookie entries", () => {
			const res = new Res();
			res.cookies.set("name", "Ozan");
			res.cookies.set("name", "Ozan");
			const matches = res.headers.getSetCookie().filter((h) => h.startsWith("name="));
			expect(matches.length).toBe(1);
		});

		it("toNativeResponse includes both manually-set headers and jar-driven Set-Cookie headers together", async () => {
			const res = new Res("body");
			res.headers.set("X-Custom", "value");
			res.cookies.set("name", "Ozan");
			const response = res.toNativeResponse();
			expect(response.headers.get("X-Custom")).toBe("value");
			expect(response.headers.get(HeaderKey.SetCookie)).toContain("name=Ozan");
		});
	});

	describe("toNativeResponse", () => {
		it("produces a null body and no content-type for a nil body", () => {
			const response = new Res(null).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBeNull();
		});

		it("stringifies a primitive string and sets text/plain", async () => {
			const response = new Res("hello").toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("text/plain");
			expect(await response.text()).toBe("hello");
		});

		it("stringifies a primitive number and sets text/plain", async () => {
			const response = new Res(42 as unknown as string).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("text/plain");
			expect(await response.text()).toBe("42");
		});

		it("forwards a Uint8Array as-is and sets application/octet-stream", async () => {
			const bytes = new TextEncoder().encode("bytes");
			const response = new Res(bytes).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("application/octet-stream");
			expect(await response.text()).toBe("bytes");
		});

		it("forwards an ArrayBuffer and sets application/octet-stream", () => {
			const response = new Res(new ArrayBuffer(4)).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("application/octet-stream");
		});

		it("uses the Blob's own type when present", () => {
			const blob = new Blob(["hi"], { type: "text/csv" });
			const response = new Res(blob).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("text/csv");
		});

		it("sets no content-type for a typeless Blob", () => {
			const blob = new Blob(["hi"]);
			const response = new Res(blob).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBeNull();
		});

		it("sets multipart/form-data for FormData", () => {
			const response = new Res(new FormData()).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("multipart/form-data");
		});

		it("sets application/x-www-form-urlencoded for URLSearchParams", () => {
			const response = new Res(new URLSearchParams("a=1")).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("application/x-www-form-urlencoded");
		});

		it("sets no content-type for a ReadableStream", () => {
			const response = new Res(new ReadableStream()).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBeNull();
		});

		it("stringifies a Date to ISO format and sets text/plain", async () => {
			const date = new Date("2024-01-01T00:00:00.000Z");
			const response = new Res(date as unknown as string).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("text/plain");
			expect(await response.text()).toBe(date.toISOString());
		});

		it("JSON-stringifies a plain object and sets application/json", async () => {
			const response = new Res({ a: 1 }).toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("application/json");
			expect(await response.text()).toBe(JSON.stringify({ a: 1 }));
		});

		it("does not overwrite a content-type already present on headers", () => {
			const res = new Res({ a: 1 });
			res.headers.set(HeaderKey.ContentType, "custom/type");
			const response = res.toNativeResponse();
			expect(response.headers.get(HeaderKey.ContentType)).toBe("custom/type");
		});

		it("builds a real Response reflecting status, statusText, and headers", () => {
			const res = new Res("body", { status: Status.CREATED, headers: { "X-Custom": "1" } });
			const response = res.toNativeResponse();
			expect(response).toBeInstanceOf(Response);
			expect(response.status).toBe(Status.CREATED);
			expect(response.headers.get("X-Custom")).toBe("1");
		});
	});

	describe("sse", () => {
		it("sets event-stream headers and returns itself for chaining", () => {
			const res = new Res();
			const returned = res.sse(() => {});
			expect(returned).toBe(res);
			expect(res.headers.get(HeaderKey.ContentType)).toBe("text/event-stream");
			expect(res.headers.get(HeaderKey.CacheControl)).toBe("no-cache");
			expect(res.headers.get(HeaderKey.Connection)).toBe("keep-alive");
		});

		it("formats a plain data-only event", async () => {
			const res = new Res().sse((send) => {
				send({ data: "hello" });
			});
			const chunk = await readOneChunk(res.body as ReadableStream<Uint8Array>);
			expect(chunk).toBe('data: "hello"\n\n');
		});

		it("includes id and event fields when provided", async () => {
			const res = new Res().sse((send) => {
				send({ data: "x", id: "1", event: "update" });
			});
			const chunk = await readOneChunk(res.body as ReadableStream<Uint8Array>);
			expect(chunk).toBe('id: 1\nevent: update\ndata: "x"\n\n');
		});

		it("prefixes a retry field when a retry interval is given", async () => {
			const res = new Res().sse((send) => {
				send({ data: "x" });
			}, 5000);
			const chunk = await readOneChunk(res.body as ReadableStream<Uint8Array>);
			expect(chunk.startsWith("retry: 5000\n")).toBe(true);
		});
	});

	describe("ndjson", () => {
		it("sets ndjson headers and returns itself for chaining", () => {
			const res = new Res();
			const returned = res.ndjson(() => {});
			expect(returned).toBe(res);
			expect(res.headers.get(HeaderKey.ContentType)).toBe("application/x-ndjson");
			expect(res.headers.get(HeaderKey.CacheControl)).toBe("no-cache");
		});

		it("writes each item as a JSON line", async () => {
			const res = new Res().ndjson((send) => {
				send({ a: 1 });
			});
			const chunk = await readOneChunk(res.body as ReadableStream<Uint8Array>);
			expect(chunk).toBe('{"a":1}\n');
		});
	});

	describe("file", () => {
		it("reads file bytes into body and returns itself for chaining", () => {
			const res = new Res();
			const returned = res.file(filePath);
			expect(returned).toBe(res);
			expect(Buffer.from(res.body as Uint8Array).toString()).toBe("hello file");
		});

		it("sets content-type and content-length headers", () => {
			const res = new Res().file(filePath);
			expect(res.headers.get(HeaderKey.ContentType)).toBe("text/plain");
			expect(res.headers.get(HeaderKey.ContentLength)).toBe(
				Buffer.byteLength("hello file").toString(),
			);
		});

		it("throws a 404 Exception when the path or XFile does not exist", () => {
			expect(() => new Res().file(path.join(dir, "missing.txt"))).toThrow(Exception);
			expect(() => new Res().file(new XFile(path.join(dir, "does-not-exist.txt")))).toThrow(
				Exception,
			);
		});
	});

	describe("streamFile", () => {
		it("returns itself for chaining and sets body to a ReadableStream", () => {
			const res = new Res();
			const returned = res.streamFile(filePath, "attachment");
			expect(returned).toBe(res);
			expect(res.body).toBeInstanceOf(ReadableStream);
		});

		it("streams the actual file content", async () => {
			const res = new Res().streamFile(filePath, "attachment");
			const text = await readStreamText(res.body as ReadableStream<Uint8Array>);
			expect(text).toBe("hello file");
		});

		it("sets content-type and content-disposition headers", () => {
			const res = new Res().streamFile(filePath, "attachment");
			expect(res.headers.get(HeaderKey.ContentType)).toBe("text/plain");
			expect(res.headers.get(HeaderKey.ContentDisposition)).toContain("attachment");
			expect(res.headers.get(HeaderKey.ContentDisposition)).toContain("note.txt");
		});

		it("allows an inline disposition", () => {
			const res = new Res().streamFile(filePath, "inline");
			expect(res.headers.get(HeaderKey.ContentDisposition)).toContain("inline");
		});

		it("throws a 404 Exception when given a nonexistent path string", () => {
			expect(() => new Res().streamFile(path.join(dir, "missing.txt"), "attachment")).toThrow(
				Exception,
			);
		});
	});

	describe("redirect / permanentRedirect / temporaryRedirect / seeOther", () => {
		it("redirect sets the given status and Location header, and returns itself", () => {
			const res = new Res();
			const returned = res.redirect("/login", 302);
			expect(returned).toBe(res);
			expect(res.status).toBe(302);
			expect(res.headers.get(HeaderKey.Location)).toBe("/login");
		});

		it("redirect accepts a URL instance", () => {
			const res = new Res().redirect(new URL("https://example.com/x"), 302);
			expect(res.headers.get(HeaderKey.Location)).toBe("https://example.com/x");
		});

		it("permanentRedirect uses status 301", () => {
			expect(new Res().permanentRedirect("/x").status).toBe(Status.MOVED_PERMANENTLY);
		});

		it("temporaryRedirect uses status 307", () => {
			expect(new Res().temporaryRedirect("/x").status).toBe(Status.TEMPORARY_REDIRECT);
		});

		it("seeOther uses status 303", () => {
			expect(new Res().seeOther("/x").status).toBe(Status.SEE_OTHER);
		});
	});
});

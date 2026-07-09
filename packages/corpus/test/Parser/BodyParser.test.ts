import { describe, it, expect } from "bun:test";

import { BodyParser } from "@/Parser/BodyParser";
import { FormDataParser } from "@/Parser/FormDataParser";
import { SearchParamsParser } from "@/Parser/SearchParamsParser";
import { Req } from "@/Req/Req";

import { TC } from "../_modules";

describe("BodyParser", () => {
	const parser = new BodyParser(new FormDataParser(), new SearchParamsParser());

	describe("parse - method gating", () => {
		it("returns empty object for GET regardless of content type", async () => {
			const req = new Req("http://localhost/", {
				method: "GET",
				headers: { "content-type": "application/json" },
			});
			const result = await parser.parse(req);
			expect(result).toEqual({});
		});

		it("returns empty object for HEAD", async () => {
			const req = new Req("http://localhost/", {
				method: "HEAD",
				headers: { "content-type": "application/json" },
			});
			const result = await parser.parse(req);
			expect(result).toEqual({});
		});

		it("returns empty object for OPTIONS", async () => {
			const req = new Req("http://localhost/", {
				method: "OPTIONS",
				headers: { "content-type": "application/json" },
			});
			const result = await parser.parse(req);
			expect(result).toEqual({});
		});

		it("parses body for POST", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ok: true }),
			});
			expect(await parser.parse(req)).toEqual({ ok: true });
		});

		it("parses body for PUT", async () => {
			const req = new Req("http://localhost/", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ok: true }),
			});
			expect(await parser.parse(req)).toEqual({ ok: true });
		});

		it("parses body for PATCH", async () => {
			const req = new Req("http://localhost/", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ok: true }),
			});
			expect(await parser.parse(req)).toEqual({ ok: true });
		});

		it("parses body for DELETE", async () => {
			const req = new Req("http://localhost/", {
				method: "DELETE",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ok: true }),
			});
			expect(await parser.parse(req)).toEqual({ ok: true });
		});

		it("parses Response (no method field) regardless of shape", async () => {
			const res = new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			});
			expect(await parser.parse(res)).toEqual({ ok: true });
		});
	});

	describe("parse - JSON", () => {
		it("parses JSON object", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "foo", qty: 2 }),
			});
			expect(await parser.parse(req)).toEqual({ name: "foo", qty: 2 });
		});

		it("parses JSON array", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify([1, 2, 3]),
			});
			expect(await parser.parse(req)).toEqual([1, 2, 3]);
		});

		it("returns empty object on malformed JSON", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{not json",
			});
			expect(await parser.parse(req)).toEqual({});
		});

		it("returns empty object on empty JSON body", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "",
			});
			expect(await parser.parse(req)).toEqual({});
		});
	});

	describe("parse - form-urlencoded", () => {
		it("parses flat fields", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "title=hello&count=5",
			});
			expect(await parser.parse(req)).toEqual({ title: "hello", count: 5 });
		});

		it("parses nested bracket notation", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "items[0][name]=foo&items[0][qty]=2",
			});
			expect(await parser.parse(req)).toEqual({ items: [{ name: "foo", qty: 2 }] });
		});

		it("returns empty object on empty body", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "",
			});
			expect(await parser.parse(req)).toEqual({});
		});

		it("returns empty object on whitespace-only body", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "   ",
			});
			expect(await parser.parse(req)).toEqual({});
		});
	});

	describe("parse - form-data", () => {
		it("parses multipart form fields", async () => {
			const fd = new FormData();
			fd.set("title", "hello");
			fd.append("ids", "1");
			fd.append("ids", "2");

			const req = new Req("http://localhost/", { method: "POST", body: fd });
			expect(req.headers.get(TC.HeaderKey.ContentType)).toInclude("form-data");
			expect(await parser.parse(req)).toEqual({ title: "hello", ids: [1, 2] });
		});

		it("preserves File values", async () => {
			const fd = new FormData();
			fd.set("image", new File([""], "x.png", { type: "image/png" }));

			const req = new Req("http://localhost/", { method: "POST", body: fd });
			const result = (await parser.parse(req)) as { image: File };
			expect(result.image).toBeInstanceOf(File);
		});
	});

	describe("parse - text and xml", () => {
		it("returns text body as string", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "text/plain" },
				body: "hello world",
			});
			expect(await parser.parse(req)).toBe("hello world");
		});

		it("returns xml body as raw string", async () => {
			const xml = "<note><to>you</to></note>";
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/xml" },
				body: xml,
			});
			expect(await parser.parse(req)).toBe(xml);
		});

		it("returns text/xml body as raw string", async () => {
			const xml = "<a/>";
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "text/xml" },
				body: xml,
			});
			expect(await parser.parse(req)).toBe(xml);
		});

		it("respects charset in content-type for large bodies", async () => {
			const text = "a".repeat(1024 * 1024 + 10); // over 1MB threshold
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: {
					"content-type": "text/plain; charset=utf-8",
					"content-length": String(text.length),
				},
				body: text,
			});
			expect(await parser.parse(req)).toBe(text);
		});
	});

	describe("parse - binary types", () => {
		const binaryCases = [
			"application/octet-stream",
			"application/pdf",
			"image/png",
			"audio/mpeg",
			"video/mp4",
		];

		for (const contentType of binaryCases) {
			it(`returns a ReadableStream for ${contentType}`, async () => {
				const bytes = new Uint8Array([1, 2, 3, 4]);
				const req = new Req("http://localhost/", {
					method: "POST",
					headers: { "content-type": contentType },
					body: bytes,
				});
				const result = await parser.parse(req);
				expect(result).toBeInstanceOf(ReadableStream);
			});
		}

		it("streams the original bytes", async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/octet-stream" },
				body: bytes,
			});
			const stream = (await parser.parse(req)) as ReadableStream<Uint8Array>;
			const reader = stream.getReader();
			const chunks: number[] = [];
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(...value);
			}
			expect(chunks).toEqual([1, 2, 3, 4]);
		});
	});

	describe("parse - unknown content type", () => {
		it("falls back to JSON parse when body is valid JSON", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/something-weird" },
				body: JSON.stringify({ a: 1 }),
			});
			expect(await parser.parse(req)).toEqual({ a: 1 });
		});

		it("falls back to text when body is not valid JSON", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				headers: { "content-type": "application/something-weird" },
				body: "plain text body",
			});
			expect(await parser.parse(req)).toBe("plain text body");
		});

		it("falls back to text when no content type is set", async () => {
			const req = new Req("http://localhost/", {
				method: "POST",
				body: "plain text body",
			});
			expect(await parser.parse(req)).toBe("plain text body");
		});
	});

	describe("parse - Response input", () => {
		it("parses a JSON Response body", async () => {
			const res = new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			});
			expect(await parser.parse(res)).toEqual({ ok: true });
		});

		it("returns stream for binary Response", async () => {
			const res = new Response(new Uint8Array([9, 9]), {
				headers: { "content-type": "application/pdf" },
			});
			expect(await parser.parse(res)).toBeInstanceOf(ReadableStream);
		});
	});
});

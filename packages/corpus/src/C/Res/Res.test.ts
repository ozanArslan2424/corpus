import { beforeEach, describe, expect, it } from "bun:test";

import { HeaderKey } from "@/C/HeaderKey/HeaderKey";
import { Res } from "@/C/Res/Res";
import { Status } from "@/C/Status/Status";
import { $registry } from "@/Registry/$registry";

beforeEach(() => $registry.reset());

describe("Res", () => {
	const ctHeader = HeaderKey.ContentType;
	const locHeader = HeaderKey.Location;
	const locUrl = "/hello";

	function expectData({
		res,
		response,
		expectedCtHeader,
		expectedStatus = Status.OK,
		expectedOK = true,
	}: {
		res: Res;
		response: Response;
		expectedCtHeader: string | null;
		expectedStatus?: number;
		expectedOK?: boolean;
	}) {
		// types and instances
		expect(res.headers).toBeInstanceOf(Headers);
		expect(res.cookies).toBeInstanceOf(Bun.CookieMap);
		expect(res.status).toBeTypeOf("number");
		expect(res.statusText).toBeTypeOf("string");

		// input data transformed
		expect(res.headers.get(ctHeader)).toBe(expectedCtHeader);
		expect(res.status).toBe(expectedStatus);

		// web data
		expect(response.headers.get(ctHeader)).toBe(expectedCtHeader);
		expect(response.status).toBe(expectedStatus);
		expect(response.ok).toBe(expectedOK);
		return;
	}

	describe("static methods", () => {
		it("redirect", async () => {
			const res = Res.redirect(locUrl);
			const response = res.response;
			expect(res.headers.get(locHeader)).toBe(locUrl);
			expect(response.headers.get(locHeader)).toBe(locUrl);
			expect(res.body).toBeUndefined();
			expectData({
				res,
				response,
				expectedOK: false,
				expectedStatus: Status.FOUND,
				expectedCtHeader: null,
			});
		});

		it("permanentRedirect", async () => {
			const res = Res.permanentRedirect(locUrl);
			const response = res.response;
			expect(res.headers.get(locHeader)).toBe(locUrl);
			expect(response.headers.get(locHeader)).toBe(locUrl);
			expect(res.body).toBeUndefined();
			expectData({
				res,
				response,
				expectedOK: false,
				expectedStatus: Status.MOVED_PERMANENTLY,
				expectedCtHeader: null,
			});
		});

		it("temporaryRedirect", async () => {
			const res = Res.temporaryRedirect(locUrl);
			const response = res.response;
			expect(res.headers.get(locHeader)).toBe(locUrl);
			expect(response.headers.get(locHeader)).toBe(locUrl);
			expect(res.body).toBeUndefined();
			expectData({
				res,
				response,
				expectedOK: false,
				expectedStatus: Status.TEMPORARY_REDIRECT,
				expectedCtHeader: null,
			});
		});

		it("seeOther", async () => {
			const res = Res.seeOther(locUrl);
			const response = res.response;
			expect(res.headers.get(locHeader)).toBe(locUrl);
			expect(response.headers.get(locHeader)).toBe(locUrl);
			expect(res.body).toBeUndefined();
			expectData({
				res,
				response,
				expectedOK: false,
				expectedStatus: Status.SEE_OTHER,
				expectedCtHeader: null,
			});
		});

		it("sse", async () => {
			const res = Res.sse((send) => {
				send({ event: "ping", data: { time: 1 } });
			});
			const response = res.response;
			expect(res.body).toBeInstanceOf(ReadableStream);
			expect(res.headers.get(HeaderKey.CacheControl)).toBe("no-cache");
			expect(res.headers.get(HeaderKey.Connection)).toBe("keep-alive");
			expectData({
				res,
				response,
				expectedOK: true,
				expectedStatus: Status.OK,
				expectedCtHeader: "text/event-stream",
			});
		});

		it("sse - stream emits correct chunks", async () => {
			const res = Res.sse((send) => {
				send({ event: "ping", data: { time: 1 } });
				send({ id: "2", event: "pong", data: { time: 2 } });
			});

			const text = await res.response.text();
			expect(text).toContain("event: ping\n");
			expect(text).toContain('data: {"time":1}\n\n');
			expect(text).toContain("id: 2\n");
			expect(text).toContain("event: pong\n");
			expect(text).toContain('data: {"time":2}\n\n');
		});

		it("sse - retry field is included when set", async () => {
			const res = Res.sse(
				(send) => {
					send({ data: "ok" });
				},
				undefined,
				3000,
			);

			const text = await res.response.text();
			expect(text).toContain("retry: 3000\n");
		});

		it("sse - cleanup is called on cancel", async () => {
			let cleaned = false;
			const res = Res.sse(() => {
				return () => {
					cleaned = true;
				};
			});

			const reader = res.response.body!.getReader();
			await reader.cancel();
			expect(cleaned).toBe(true);
		});

		it("sse async - stream emits correct chunks", async () => {
			const res = Res.sse(async (send) => {
				send({ event: "ping", data: { time: 1 } });
				send({ id: "2", event: "pong", data: { time: 2 } });
			});

			const text = await res.response.text();
			expect(text).toContain("event: ping\n");
			expect(text).toContain('data: {"time":1}\n\n');
			expect(text).toContain("id: 2\n");
			expect(text).toContain("event: pong\n");
			expect(text).toContain('data: {"time":2}\n\n');
		});

		it("sse async - retry field is included when set", async () => {
			const res = Res.sse(
				async (send) => {
					send({ data: "ok" });
				},
				undefined,
				3000,
			);

			const text = await res.response.text();
			expect(text).toContain("retry: 3000\n");
		});

		it("sse async - cleanup is called on cancel", async () => {
			let cleaned = false;
			const res = Res.sse(async () => {
				return () => {
					cleaned = true;
				};
			});

			const reader = res.response.body!.getReader();
			await reader.cancel();
			expect(cleaned).toBe(true);
		});

		it("ndjson - returns stream with correct headers", () => {
			const res = Res.ndjson((send) => {
				send({ id: 1 });
			});
			const response = res.response;

			expect(res.status).toBe(Status.OK);
			expect(res.body).toBeInstanceOf(ReadableStream);
			expect(res.headers.get(ctHeader)).toBe("application/x-ndjson");
			expect(response.headers.get(ctHeader)).toBe("application/x-ndjson");
		});

		it("ndjson - stream emits correct chunks", async () => {
			const res = Res.ndjson((send) => {
				send({ id: 1, name: "alice" });
				send({ id: 2, name: "bob" });
			});

			const text = await res.response.text();
			const lines = text.trim().split("\n");
			expect(lines).toHaveLength(2);
			expect(lines[0]).toBeDefined();
			expect(lines[1]).toBeDefined();

			expect(JSON.parse(lines[0]!)).toEqual({ id: 1, name: "alice" });
			expect(JSON.parse(lines[1]!)).toEqual({ id: 2, name: "bob" });
		});

		it("ndjson - cleanup is called on cancel", async () => {
			let cleaned = false;
			const res = Res.ndjson(() => {
				return () => {
					cleaned = true;
				};
			});

			const reader = res.response.body!.getReader();
			await reader.cancel();
			expect(cleaned).toBe(true);
		});

		it("ndjson async  - returns stream with correct headers", () => {
			const res = Res.ndjson(async (send) => {
				send({ id: 1 });
			});
			const response = res.response;

			expect(res.status).toBe(Status.OK);
			expect(res.body).toBeInstanceOf(ReadableStream);
			expect(res.headers.get(ctHeader)).toBe("application/x-ndjson");
			expect(response.headers.get(ctHeader)).toBe("application/x-ndjson");
		});

		it("ndjson async  - stream emits correct chunks", async () => {
			const res = Res.ndjson(async (send) => {
				send({ id: 1, name: "alice" });
				send({ id: 2, name: "bob" });
			});

			const text = await res.response.text();
			const lines = text.trim().split("\n");
			expect(lines).toHaveLength(2);
			expect(lines[0]).toBeDefined();
			expect(lines[1]).toBeDefined();

			expect(JSON.parse(lines[0]!)).toEqual({ id: 1, name: "alice" });
			expect(JSON.parse(lines[1]!)).toEqual({ id: 2, name: "bob" });
		});

		it("ndjson async  - cleanup is called on cancel", async () => {
			let cleaned = false;
			const res = Res.ndjson(async () => {
				return () => {
					cleaned = true;
				};
			});

			const reader = res.response.body!.getReader();
			await reader.cancel();
			expect(cleaned).toBe(true);
		});

		it("streamfile - returns stream with correct headers for txt", async () => {
			const res = await Res.streamFile("test/fixtures/sample.txt");

			expect(res.status).toBe(Status.OK);
			expect(res.body).toBeInstanceOf(ReadableStream);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(res.headers.get(HeaderKey.ContentDisposition)).toBe(
				'attachment; filename="sample.txt"',
			);
		});

		it("streamfile - infers correct mime type", async () => {
			const cases: [string, string][] = [
				["test/fixtures/sample.html", "text/html"],
				["test/fixtures/sample.css", "text/css"],
				["test/fixtures/sample.js", "text/javascript"],
				["test/fixtures/sample.json", "application/json"],
				["test/fixtures/sample.what", "application/octet-stream"],
			];

			for (const [path, expectedMime] of cases) {
				const res = await Res.streamFile(path);
				expect(res.headers.get(ctHeader)).toBe(expectedMime);
			}
		});

		it("streamfile - inline disposition", async () => {
			const res = await Res.streamFile("test/fixtures/sample.txt", "inline");
			expect(res.headers.get(HeaderKey.ContentDisposition)).toBe('inline; filename="sample.txt"');
		});

		it("streamfile - throws not found for missing file", () => {
			expect(Res.streamFile("test/fixtures/does-not-exist.txt")).rejects.toThrow();
		});

		it("streamfile - body contains file content", async () => {
			const res = await Res.streamFile("test/fixtures/sample.txt");
			const text = await res.response.text();
			expect(text.length).toBeGreaterThan(0);
		});
	});

	describe("body", () => {
		it("empty body", async () => {
			const res = new Res();
			const response = res.response;
			const data = await response.text();
			expect(data).toBe("");
			expectData({
				res,
				response,
				expectedCtHeader: null,
			});
		});

		it("null body", async () => {
			const res = new Res(null);
			const response = res.response;
			const data = await response.text();
			expect(data).toBe("");
			expectData({
				res,
				response,
				expectedCtHeader: null,
			});
		});

		it("undefined body", async () => {
			const res = new Res(undefined);
			const response = res.response;
			const data = await response.text();
			expect(data).toBe("");
			expectData({
				res,
				response,
				expectedCtHeader: null,
			});
		});

		it("arraybuffer body", async () => {
			const buffer = new TextEncoder().encode("hello").buffer;
			const res = new Res(buffer);
			const response = res.response;

			expect(res.body).toBeInstanceOf(ArrayBuffer);
			expect(res.headers.get(ctHeader)).toBe("application/octet-stream");
			expect(res.status).toBe(Status.OK);
			const text = await response.text();
			expect(text).toBe("hello");
		});

		it("blob body", async () => {
			const blob = new Blob(["hello"], { type: "text/html" });
			const res = new Res(blob);
			const response = res.response;

			expect(res.body).toBeInstanceOf(Blob);
			expect(res.status).toBe(Status.OK);
			const text = await response.text();
			expect(text).toBe("hello");
			expect(response.headers.get(ctHeader)).toContain("text/html");
		});

		it("custom object body", async () => {
			class Obj {
				public readonly key = "value";
			}
			const res = new Res(new Obj());
			const response = res.response;

			expect(res.status).toBe(Status.OK);
			const data = await response.json();
			expect(data).toEqual({ key: "value" });
			expect(response.headers.get(ctHeader)).toContain("application/json");
		});

		it("formdata body", async () => {
			const form = new FormData();
			form.append("name", "corpus");
			const res = new Res(form);
			const response = res.response;

			expect(res.body).toBeInstanceOf(FormData);
			expect(res.status).toBe(Status.OK);
			const text = await response.text();
			expect(text).toContain("corpus");
			expect(response.headers.get(ctHeader)).toContain("multipart/form-data");
		});

		it("urlsearchparams body", async () => {
			const params = new URLSearchParams({ name: "corpus" });
			const res = new Res(params);
			const response = res.response;

			expect(res.body).toBeInstanceOf(URLSearchParams);
			expect(res.status).toBe(Status.OK);
			const text = await response.text();
			expect(text).toBe("name=corpus");
			expect(response.headers.get(ctHeader)).toContain("application/x-www-form-urlencoded");
		});

		it("string body", async () => {
			const res = new Res("hello");
			const response = res.response;
			expect(res.body).toBe("hello");
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("hello");
		});

		it("empty string body", async () => {
			const res = new Res("");
			const response = res.response;
			expect(res.body).toBe("");
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("");
		});

		it("number body", async () => {
			const res = new Res(42);
			const response = res.response;
			expect(res.body).toBe(42);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("42");
		});

		it("zero body", async () => {
			const res = new Res(0);
			const response = res.response;
			expect(res.body).toBe(0);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("0");
		});

		it("boolean true body", async () => {
			const res = new Res(true);
			const response = res.response;
			expect(res.body).toBe(true);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("true");
		});

		it("boolean false body", async () => {
			const res = new Res(false);
			const response = res.response;
			expect(res.body).toBe(false);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("false");
		});

		it("bigint body", async () => {
			const res = new Res(9007199254740993n);
			const response = res.response;
			expect(res.body).toBe(9007199254740993n);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe("9007199254740993");
		});

		it("date body", async () => {
			const date = new Date("2024-01-01T00:00:00.000Z");
			const res = new Res(date);
			const response = res.response;
			expect(res.body).toBe(date);
			expect(res.headers.get(ctHeader)).toBe("text/plain");
			expect(await response.text()).toBe(date.toISOString());
		});

		it("plain object body", async () => {
			const obj = { a: 1, b: "two", c: true };
			const res = new Res(obj);
			const response = res.response;
			expect(res.body).toEqual(obj);
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual(obj);
		});

		it("empty object body", async () => {
			const res = new Res({});
			const response = res.response;
			expect(res.body).toEqual({});
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual({});
		});

		it("nested object body", async () => {
			const obj = { a: { b: { c: [1, 2, 3] } } };
			const res = new Res(obj);
			const response = res.response;
			expect(res.body).toEqual(obj);
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual(obj);
		});

		it("array body", async () => {
			const arr = [1, "two", true, null];
			const res = new Res(arr);
			const response = res.response;
			expect(res.body).toEqual(arr);
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual(arr);
		});

		it("empty array body", async () => {
			const res = new Res([]);
			const response = res.response;
			expect(res.body).toEqual([]);
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual([]);
		});

		it("array of objects body", async () => {
			const arr = [{ id: 1 }, { id: 2 }];
			const res = new Res(arr);
			const response = res.response;
			expect(res.body).toBe(arr);
			expect(res.headers.get(ctHeader)).toBe("application/json");
			expect(await response.json()).toEqual(arr);
		});

		it("readable stream body", async () => {
			const encoder = new TextEncoder();
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(encoder.encode("chunk1"));
					controller.enqueue(encoder.encode("chunk2"));
					controller.close();
				},
			});
			const res = new Res(stream);
			const response = res.response;
			expect(res.body).toBeInstanceOf(ReadableStream);
			expect(await response.text()).toBe("chunk1chunk2");
		});
	});
});

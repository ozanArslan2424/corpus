import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "./_modules";

beforeEach(() => $registryTesting.reset());

describe("C.Res", () => {
	const ctHeader = TC.CommonHeaders.ContentType;
	const otherHeader = "other-header";
	const otherHeaderValue = "other-header-value";
	const locHeader = TC.CommonHeaders.Location;
	const locUrl = "/hello";

	function expectData({
		res,
		response,
		data,
		expectedBody = "",
		expectedCtHeader = "text/plain",
		expectedStatus = TC.Status.OK,
		expectedOK = true,
	}: {
		res: TC.Res;
		response: Response;
		data: any;
		expectedBody?: any;
		expectedCtHeader?: string;
		expectedStatus?: number;
		expectedOK?: boolean;
	}) {
		// types and instances
		expect(res.headers).toBeInstanceOf(TC.Headers);
		expect(res.cookies).toBeInstanceOf(TC.Cookies);
		expect(res.status).toBeTypeOf("number");
		expect(res.statusText).toBeTypeOf("string");

		// input data transformed
		expect(res.body).toBe(expectedBody);
		expect(res.headers.get(ctHeader)).toBe(expectedCtHeader);
		expect(res.status).toBe(expectedStatus);

		// web data
		expect(data).toBe(expectedBody);
		expect(response.headers.get(ctHeader)).toBe(expectedCtHeader);
		expect(response.status).toBe(expectedStatus);
		expect(response.ok).toBe(expectedOK);
		return;
	}

	it("REDIRECT BY INIT HEADERS", async () => {
		const res = new TC.Res(undefined, { headers: [[locHeader, locUrl]] });
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - REDIRECT", async () => {
		const res = TC.Res.redirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - REDIRECT - WITH EXTRA HEADERS", async () => {
		const res = TC.Res.redirect(locUrl, {
			headers: [[otherHeader, otherHeaderValue]],
		});
		expect(res.headers.get(locHeader)).toBe(locUrl);
		expect(res.headers.get(otherHeader)).toBe(otherHeaderValue);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		expect(response.headers.get(otherHeader)).toBe(otherHeaderValue);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - PERMANENT REDIRECT", async () => {
		const res = TC.Res.permanentRedirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.MOVED_PERMANENTLY,
		});
	});

	it("REDIRECT BY STATIC METHOD - TEMPORARY REDIRECT", async () => {
		const res = TC.Res.temporaryRedirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.TEMPORARY_REDIRECT,
		});
	});

	it("REDIRECT BY STATIC METHOD - SEE OTHER", async () => {
		const res = TC.Res.seeOther(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: TC.Status.SEE_OTHER,
		});
	});

	it("SSE - RETURNS STREAM WITH CORRECT HEADERS", () => {
		const res = TC.Res.sse((send) => {
			send({ event: "ping", data: { time: 1 } });
		});
		const response = res.response;

		expect(res.status).toBe(TC.Status.OK);
		expect(res.body).toBeInstanceOf(ReadableStream);
		expect(res.headers.get(TC.CommonHeaders.ContentType)).toBe("text/event-stream");
		expect(res.headers.get(TC.CommonHeaders.CacheControl)).toBe("no-cache");
		expect(res.headers.get(TC.CommonHeaders.Connection)).toBe("keep-alive");
		expect(response.headers.get(TC.CommonHeaders.ContentType)).toBe("text/event-stream");
	});

	it("SSE - STREAM EMITS CORRECT CHUNKS", async () => {
		const res = TC.Res.sse((send) => {
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

	it("SSE - RETRY FIELD IS INCLUDED WHEN SET", async () => {
		const res = TC.Res.sse(
			(send) => {
				send({ data: "ok" });
			},
			undefined,
			3000,
		);

		const text = await res.response.text();
		expect(text).toContain("retry: 3000\n");
	});

	it("SSE - CLEANUP IS CALLED ON CANCEL", async () => {
		let cleaned = false;
		const res = TC.Res.sse(() => {
			return () => {
				cleaned = true;
			};
		});

		const reader = res.response.body!.getReader();
		await reader.cancel();
		expect(cleaned).toBe(true);
	});

	it("NDJSON - RETURNS STREAM WITH CORRECT HEADERS", () => {
		const res = TC.Res.ndjson((send) => {
			send({ id: 1 });
		});
		const response = res.response;

		expect(res.status).toBe(TC.Status.OK);
		expect(res.body).toBeInstanceOf(ReadableStream);
		expect(res.headers.get(ctHeader)).toBe("application/x-ndjson");
		expect(response.headers.get(ctHeader)).toBe("application/x-ndjson");
	});

	it("NDJSON - STREAM EMITS CORRECT CHUNKS", async () => {
		const res = TC.Res.ndjson((send) => {
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

	it("NDJSON - CLEANUP IS CALLED ON CANCEL", async () => {
		let cleaned = false;
		const res = TC.Res.ndjson(() => {
			return () => {
				cleaned = true;
			};
		});

		const reader = res.response.body!.getReader();
		await reader.cancel();
		expect(cleaned).toBe(true);
	});

	// ─── streamFile ───────────────────────────────────────────────────────────────

	it("STREAM FILE - RETURNS STREAM WITH CORRECT HEADERS FOR TXT", async () => {
		const res = await TC.Res.streamFile("test/fixtures/sample.txt");

		expect(res.status).toBe(TC.Status.OK);
		expect(res.body).toBeInstanceOf(ReadableStream);
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(res.headers.get(TC.CommonHeaders.ContentDisposition)).toBe(
			'attachment; filename="sample.txt"',
		);
	});

	it("STREAM FILE - INFERS CORRECT MIME TYPE", async () => {
		const cases: [string, string][] = [
			["test/fixtures/sample.html", "text/html"],
			["test/fixtures/sample.css", "text/css"],
			["test/fixtures/sample.js", "text/javascript"],
			["test/fixtures/sample.json", "application/json"],
			["test/fixtures/sample.what", "application/octet-stream"],
		];

		for (const [path, expectedMime] of cases) {
			const res = await TC.Res.streamFile(path);
			expect(res.headers.get(ctHeader)).toBe(expectedMime);
		}
	});

	it("STREAM FILE - INLINE DISPOSITION", async () => {
		const res = await TC.Res.streamFile("test/fixtures/sample.txt", "inline");
		expect(res.headers.get(TC.CommonHeaders.ContentDisposition)).toBe(
			'inline; filename="sample.txt"',
		);
	});

	it("STREAM FILE - THROWS NOT FOUND FOR MISSING FILE", () => {
		expect(TC.Res.streamFile("test/fixtures/does-not-exist.txt")).rejects.toThrow();
	});

	it("STREAM FILE - BODY CONTAINS FILE CONTENT", async () => {
		const res = await TC.Res.streamFile("test/fixtures/sample.txt");
		const text = await res.response.text();
		expect(text.length).toBeGreaterThan(0);
	});

	// ─── Primitives ───────────────────────────────────────────────────────────────

	it("EMPTY BODY", async () => {
		const res = new TC.Res();
		const response = res.response;
		const data = await response.text();
		expectData({
			res,
			response,
			data,
		});
	});

	it("NULL BODY", async () => {
		const res = new TC.Res(null);
		const response = res.response;
		const data = await response.text();
		expectData({
			res,
			response,
			data,
		});
	});

	it("UNDEFINED BODY", async () => {
		const res = new TC.Res(undefined);
		const response = res.response;
		const data = await response.text();
		expectData({
			res,
			response,
			data,
		});
	});

	it("ARRAYBUFFER BODY", async () => {
		const buffer = new TextEncoder().encode("hello").buffer;
		const res = new TC.Res(buffer);
		const response = res.response;

		expect(res.body).toBeInstanceOf(ArrayBuffer);
		expect(res.headers.get(ctHeader)).toBe("application/octet-stream");
		expect(res.status).toBe(TC.Status.OK);
		const text = await response.text();
		expect(text).toBe("hello");
	});

	it("BLOB BODY", async () => {
		const blob = new Blob(["hello"], { type: "text/html" });
		const res = new TC.Res(blob);
		const response = res.response;

		expect(res.body).toBeInstanceOf(Blob);
		expect(res.status).toBe(TC.Status.OK);
		const text = await response.text();
		expect(text).toBe("hello");
		expect(response.headers.get(ctHeader)).toContain("text/html");
	});

	it("CUSTOM OBJECT BODY", async () => {
		class Obj {
			public readonly key = "value";
		}
		const res = new TC.Res(new Obj());
		const response = res.response;

		expect(res.status).toBe(TC.Status.OK);
		const data = await response.json();
		expect(data).toEqual({ key: "value" });
		expect(response.headers.get(ctHeader)).toContain("application/json");
	});

	it("FORMDATA BODY", async () => {
		const form = new FormData();
		form.append("name", "corpus");
		const res = new TC.Res(form);
		const response = res.response;

		expect(res.body).toBeInstanceOf(FormData);
		expect(res.status).toBe(TC.Status.OK);
		const text = await response.text();
		expect(text).toContain("corpus");
		expect(response.headers.get(ctHeader)).toContain("multipart/form-data");
	});

	it("URLSEARCHPARAMS BODY", async () => {
		const params = new URLSearchParams({ name: "corpus" });
		const res = new TC.Res(params);
		const response = res.response;

		expect(res.body).toBeInstanceOf(URLSearchParams);
		expect(res.status).toBe(TC.Status.OK);
		const text = await response.text();
		expect(text).toBe("name=corpus");
		expect(response.headers.get(ctHeader)).toContain("application/x-www-form-urlencoded");
	});

	it("STRING BODY", async () => {
		const res = new TC.Res("hello");
		const response = res.response;
		expect(res.body).toBe("hello");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("hello");
	});

	it("EMPTY STRING BODY", async () => {
		const res = new TC.Res("");
		const response = res.response;
		expect(res.body).toBe("");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("");
	});

	it("NUMBER BODY", async () => {
		const res = new TC.Res(42);
		const response = res.response;
		expect(res.body).toBe("42");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("42");
	});

	it("ZERO BODY", async () => {
		const res = new TC.Res(0);
		const response = res.response;
		expect(res.body).toBe("0");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("0");
	});

	it("BOOLEAN TRUE BODY", async () => {
		const res = new TC.Res(true);
		const response = res.response;
		expect(res.body).toBe("true");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("true");
	});

	it("BOOLEAN FALSE BODY", async () => {
		const res = new TC.Res(false);
		const response = res.response;
		expect(res.body).toBe("false");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("false");
	});

	it("BIGINT BODY", async () => {
		const res = new TC.Res(9007199254740993n);
		const response = res.response;
		expect(res.body).toBe("9007199254740993");
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("9007199254740993");
	});

	it("DATE BODY", async () => {
		const date = new Date("2024-01-01T00:00:00.000Z");
		const res = new TC.Res(date);
		const response = res.response;
		expect(res.body).toBe(date.toISOString());
		expect(res.headers.get(ctHeader)).toBe("text/plain");
		expect(await response.text()).toBe("2024-01-01T00:00:00.000Z");
	});

	it("PLAIN OBJECT BODY", async () => {
		const obj = { a: 1, b: "two", c: true };
		const res = new TC.Res(obj);
		const response = res.response;
		expect(res.body).toBe(JSON.stringify(obj));
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual(obj);
	});

	it("EMPTY OBJECT BODY", async () => {
		const res = new TC.Res({});
		const response = res.response;
		expect(res.body).toBe("{}");
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual({});
	});

	it("NESTED OBJECT BODY", async () => {
		const obj = { a: { b: { c: [1, 2, 3] } } };
		const res = new TC.Res(obj);
		const response = res.response;
		expect(res.body).toBe(JSON.stringify(obj));
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual(obj);
	});

	it("ARRAY BODY", async () => {
		const arr = [1, "two", true, null];
		const res = new TC.Res(arr);
		const response = res.response;
		expect(res.body).toBe(JSON.stringify(arr));
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual(arr);
	});

	it("EMPTY ARRAY BODY", async () => {
		const res = new TC.Res([]);
		const response = res.response;
		expect(res.body).toBe("[]");
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual([]);
	});

	it("ARRAY OF OBJECTS BODY", async () => {
		const arr = [{ id: 1 }, { id: 2 }];
		const res = new TC.Res(arr);
		const response = res.response;
		expect(res.body).toBe(JSON.stringify(arr));
		expect(res.headers.get(ctHeader)).toBe("application/json");
		expect(await response.json()).toEqual(arr);
	});

	it("READABLE STREAM BODY", async () => {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode("chunk1"));
				controller.enqueue(encoder.encode("chunk2"));
				controller.close();
			},
		});
		const res = new TC.Res(stream);
		const response = res.response;
		expect(res.body).toBeInstanceOf(ReadableStream);
		expect(await response.text()).toBe("chunk1chunk2");
	});
});

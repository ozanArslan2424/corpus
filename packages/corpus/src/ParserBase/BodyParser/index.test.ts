import { afterAll, describe, expect, it, mock } from "bun:test";

import { Exception } from "@/Exception";
import { Globals } from "@/Globals";
import { getOrInitParsersRegistry, setParsersRegistry } from "@/Globals/ParsersRegistry";
import { HeaderKey } from "@/Headers";
import type { ParserBaseInterface } from "@/ParserBase";
import { BodyParser } from "@/ParserBase/BodyParser";
import { Res, Status } from "@/Res";

function makeFormDataParserMock(returnValue: Record<string, unknown> = { formData: true }) {
	return { parse: mock((_input: FormData) => returnValue) } satisfies ParserBaseInterface<FormData>;
}

function makeSearchParamsParserMock(returnValue: Record<string, unknown> = { searchParams: true }) {
	return {
		parse: mock((_input: URLSearchParams) => returnValue),
	} satisfies ParserBaseInterface<URLSearchParams>;
}

function makeRequest(
	body: BodyInit | null,
	headers: Record<string, string> = {},
	init: Record<string, unknown> = {},
): Request {
	return new Request("http://localhost/test", {
		method: "POST",
		body,
		headers,
		...init,
	} as RequestInit);
}

function makeResponse(body: BodyInit | null, headers: Record<string, string> = {}): Response {
	return new Response(body, { headers });
}

function encode(text: string): Blob {
	return new Blob([text]);
}

function setup() {
	const formDataParser = makeFormDataParserMock();
	const searchParamsParser = makeSearchParamsParserMock();
	setParsersRegistry({
		formDataParser,
		searchParamsParser,
	});
	const bodyParser = new BodyParser();
	return { formDataParser, searchParamsParser, bodyParser };
}

afterAll(() => {
	Globals.delete("parsers");
	getOrInitParsersRegistry();
});

describe("BodyParser", () => {
	describe("content-type dispatch", () => {
		it("parses application/json bodies", async () => {
			const { bodyParser } = setup();
			const req = makeRequest(JSON.stringify({ a: 1 }), {
				[HeaderKey.ContentType]: "application/json",
			});
			expect(bodyParser.parse(req)).resolves.toEqual({ a: 1 });
		});

		it("parses JSON array bodies", async () => {
			const { bodyParser } = setup();
			const req = makeRequest(JSON.stringify([1, 2, 3]), {
				[HeaderKey.ContentType]: "application/json",
			});
			expect(bodyParser.parse(req)).resolves.toEqual([1, 2, 3]);
		});

		it("ignores extra content-type parameters like charset", async () => {
			const { bodyParser } = setup();
			const req = makeRequest(JSON.stringify({ a: 1 }), {
				[HeaderKey.ContentType]: "application/json; charset=utf-8",
			});
			expect(bodyParser.parse(req)).resolves.toEqual({ a: 1 });
		});

		it("delegates application/x-www-form-urlencoded bodies to the search params parser", async () => {
			const { bodyParser, searchParamsParser } = setup();
			const req = makeRequest("a=1&b=2", {
				[HeaderKey.ContentType]: "application/x-www-form-urlencoded",
			});
			const result = await bodyParser.parse(req);
			expect(result).toEqual({ searchParams: true });
			expect(searchParamsParser.parse).toHaveBeenCalledTimes(1);
			const [passedParams] = searchParamsParser.parse.mock.calls[0]!;
			expect(passedParams).toBeInstanceOf(URLSearchParams);
			expect((passedParams as URLSearchParams).get("a")).toBe("1");
			expect((passedParams as URLSearchParams).get("b")).toBe("2");
		});

		it("delegates multipart/form-data bodies to the form data parser", async () => {
			const { bodyParser, formDataParser } = setup();
			const fd = new FormData();
			fd.append("name", "Ozan");
			const req = new Request("http://localhost/test", { method: "POST", body: fd });

			const result = await bodyParser.parse(req);
			expect(result).toEqual({ formData: true });
			expect(formDataParser.parse).toHaveBeenCalledTimes(1);
			const [passedFormData] = formDataParser.parse.mock.calls[0]!;
			expect(passedFormData).toBeInstanceOf(FormData);
			expect((passedFormData as FormData).get("name")).toBe("Ozan");
		});

		it("parses text/plain bodies as plain text", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("hello world", { [HeaderKey.ContentType]: "text/plain" });
			expect(bodyParser.parse(req)).resolves.toBe("hello world");
		});

		it("parses application/xml bodies as text", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("<a/>", { [HeaderKey.ContentType]: "application/xml" });
			expect(bodyParser.parse(req)).resolves.toBe("<a/>");
		});

		it("parses text/xml bodies as text", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("<a/>", { [HeaderKey.ContentType]: "text/xml" });
			expect(bodyParser.parse(req)).resolves.toBe("<a/>");
		});

		it.each([
			"application/octet-stream",
			"application/pdf",
			"image/png",
			"audio/mpeg",
			"video/mp4",
		])("treats %s as binary and returns the raw stream", async (contentType) => {
			const { bodyParser } = setup();
			const req = makeRequest("some bytes", { [HeaderKey.ContentType]: contentType });
			const result = await bodyParser.parse(req);
			expect(result).toBeInstanceOf(ReadableStream);
		});

		it("returns an empty object for a binary content type with no body", async () => {
			const { bodyParser } = setup();
			const res = makeResponse(null, { [HeaderKey.ContentType]: "application/octet-stream" });
			expect(await bodyParser.parse(res)).toEqual({});
		});

		it("parses unknown content types as JSON when the body looks like JSON", async () => {
			const { bodyParser } = setup();
			const req = makeRequest(encode(JSON.stringify({ x: 5 })));
			expect(bodyParser.parse(req)).resolves.toEqual({ x: 5 });
		});

		it("falls back to plain text for unknown content types that aren't JSON", async () => {
			const { bodyParser } = setup();
			const req = makeRequest(encode("just some text"));
			expect(bodyParser.parse(req)).resolves.toBe("just some text");
		});

		it("returns an empty object for an unrecognized content type with no body", async () => {
			const { bodyParser } = setup();
			const res = makeResponse(null);
			expect(await bodyParser.parse(res)).toEqual({});
		});
	});

	describe("malformed bodies", () => {
		it("wraps a SyntaxError into a 400 Exception, preserving the original message", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("{not valid json", { [HeaderKey.ContentType]: "application/json" });
			let error: unknown;
			try {
				await bodyParser.parse(req);
				throw new Error("expected parse to throw");
			} catch (err) {
				error = err;
			}
			expect(error).toBeInstanceOf(Exception);
			expect((error as Exception).status).toBe(Status.BAD_REQUEST);
		});

		it("attaches the original received value and content-type as the Exception's data", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("{not valid json", { [HeaderKey.ContentType]: "application/json" });
			try {
				await bodyParser.parse(req);
				throw new Error("expected parse to throw");
			} catch (err) {
				const data = (err as Exception).data as { contentType: string };
				expect(data.contentType).toBe("application/json");
			}
		});

		it("re-throws non-SyntaxError errors instead of wrapping them", async () => {
			const { bodyParser, formDataParser } = setup();
			formDataParser.parse.mockImplementationOnce(() => {
				throw new Error("boom");
			});
			const fd = new FormData();
			const req = new Request("http://localhost/test", { method: "POST", body: fd });
			expect(bodyParser.parse(req)).rejects.toThrow("boom");
		});
	});

	describe("input normalization", () => {
		it("accepts a Response directly", async () => {
			const { bodyParser } = setup();
			const res = makeResponse(JSON.stringify({ a: 1 }), {
				[HeaderKey.ContentType]: "application/json",
			});
			expect(bodyParser.parse(res)).resolves.toEqual({ a: 1 });
		});

		it("accepts a Res and reads its native Response body", async () => {
			const { bodyParser } = setup();
			const res = new Res({ a: 1 });
			expect(bodyParser.parse(res)).resolves.toEqual({ a: 1 });
		});
	});

	describe("text charset handling", () => {
		it("defaults to UTF-8 decoding when no charset is given", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("héllo", { [HeaderKey.ContentType]: "text/plain" });
			expect(bodyParser.parse(req)).resolves.toBe("héllo");
		});

		it("decodes using an explicit non-UTF-8 charset", async () => {
			// 0xE9 is "é" in ISO-8859-1, but is not valid standalone UTF-8
			const bytes = new Uint8Array([0x68, 0xe9]);
			const { bodyParser } = setup();
			const req = makeRequest(bytes, { [HeaderKey.ContentType]: "text/plain; charset=iso-8859-1" });
			expect(bodyParser.parse(req)).resolves.toBe("h\u00e9");
		});

		it("falls back to UTF-8 for an unrecognized charset label", async () => {
			const { bodyParser } = setup();
			const req = makeRequest("hello", {
				[HeaderKey.ContentType]: "text/plain; charset=totally-bogus",
			});
			expect(bodyParser.parse(req)).resolves.toBe("hello");
		});
	});
});

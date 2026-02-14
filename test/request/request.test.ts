import { CommonHeaders, Cookies, Method } from "@/index";
import { HttpHeaders } from "@/modules/HttpHeaders/HttpHeaders";
import { HttpRequest } from "@/modules/HttpRequest/HttpRequest";
import { describe, expect, it } from "bun:test";
import { TEST_URL } from "../utils/TEST_URL";
import { Parser } from "@/modules/Parser/Parser";

const ctReq = (ct: string) =>
	new HttpRequest(TEST_URL, {
		method: Method.POST,
		headers: { [CommonHeaders.ContentType]: ct },
	});

describe("Request", () => {
	it("instances", () => {
		const req = new HttpRequest(TEST_URL);
		expect(req.cookies).toBeInstanceOf(Cookies);
		expect(req.headers).toBeInstanceOf(HttpHeaders);
		expect(req.method).toBe(Method.GET);
	});

	it("input is url", () => {
		const req = new HttpRequest(TEST_URL);
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is url - Method", () => {
		const req = new HttpRequest(TEST_URL, { method: Method.POST });
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.POST);
	});

	it("input is url - Headers", () => {
		const req = new HttpRequest(TEST_URL, { headers: { test: "header" } });
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("input is Request", () => {
		const req = new HttpRequest(new Request(TEST_URL));
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is Request - Method", () => {
		const req = new HttpRequest(new Request(TEST_URL, { method: Method.POST }));
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.POST);
	});

	it("input is Request - Headers", () => {
		const req = new HttpRequest(
			new Request(TEST_URL, { headers: { test: "header" } }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("input is HttpRequest", () => {
		const req = new HttpRequest(new HttpRequest(TEST_URL));
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is HttpRequest - Method", () => {
		const req = new HttpRequest(
			new HttpRequest(TEST_URL, { method: Method.GET }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.GET);
	});

	it("input is HttpRequest - Headers", () => {
		const req = new HttpRequest(
			new HttpRequest(TEST_URL, { headers: { test: "header" } }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("isPreflight", () => {
		const req = new HttpRequest(TEST_URL, {
			method: Method.OPTIONS,
			headers: {
				[CommonHeaders.AccessControlRequestMethod]: Method.GET,
			},
		});
		expect(req.isPreflight).toBe(true);
	});
	it("normalizedContentType - application/json", () => {
		const json = ctReq("application/json");
		expect(Parser.getNormalizedContentType(json)).toBe("json");
		expect(json.headers.get(CommonHeaders.ContentType)).toBe(
			"application/json",
		);
	});
	it("normalizedContentType - application/json; charset=utf-8", () => {
		const jsonCharset = ctReq("application/json; charset=utf-8");
		expect(Parser.getNormalizedContentType(jsonCharset)).toBe("json");
		expect(jsonCharset.headers.get(CommonHeaders.ContentType)).toBe(
			"application/json; charset=utf-8",
		);
	});

	it("normalizedContentType - application/x-www-form-urlencoded", () => {
		const formUrlEncoded = ctReq("application/x-www-form-urlencoded");
		expect(Parser.getNormalizedContentType(formUrlEncoded)).toBe(
			"form-urlencoded",
		);
		expect(formUrlEncoded.headers.get(CommonHeaders.ContentType)).toBe(
			"application/x-www-form-urlencoded",
		);
	});

	it("normalizedContentType - multipart/form-data", () => {
		const formData = ctReq("multipart/form-data");
		expect(Parser.getNormalizedContentType(formData)).toBe("form-data");
		expect(formData.headers.get(CommonHeaders.ContentType)).toBe(
			"multipart/form-data",
		);
	});

	it("normalizedContentType - text/plain", () => {
		const text = ctReq("text/plain");
		expect(Parser.getNormalizedContentType(text)).toBe("text");
		expect(text.headers.get(CommonHeaders.ContentType)).toBe("text/plain");
	});

	it("normalizedContentType - application/xml", () => {
		const appXml = ctReq("application/xml");
		expect(Parser.getNormalizedContentType(appXml)).toBe("xml");
		expect(appXml.headers.get(CommonHeaders.ContentType)).toBe(
			"application/xml",
		);
	});

	it("normalizedContentType - text/xml", () => {
		const textXml = ctReq("text/xml");
		expect(Parser.getNormalizedContentType(textXml)).toBe("xml");
		expect(textXml.headers.get(CommonHeaders.ContentType)).toBe("text/xml");
	});

	it("normalizedContentType - application/octet-stream", () => {
		const binary = ctReq("application/octet-stream");
		expect(Parser.getNormalizedContentType(binary)).toBe("binary");
		expect(binary.headers.get(CommonHeaders.ContentType)).toBe(
			"application/octet-stream",
		);
	});

	it("normalizedContentType - application/pdf", () => {
		const pdf = ctReq("application/pdf");
		expect(Parser.getNormalizedContentType(pdf)).toBe("pdf");
		expect(pdf.headers.get(CommonHeaders.ContentType)).toBe("application/pdf");
	});

	it("normalizedContentType - image/png", () => {
		const img = ctReq("image/png");
		expect(Parser.getNormalizedContentType(img)).toBe("image");
		expect(img.headers.get(CommonHeaders.ContentType)).toBe("image/png");
	});

	it("normalizedContentType - audio/mpeg", () => {
		const audio = ctReq("audio/mpeg");
		expect(Parser.getNormalizedContentType(audio)).toBe("audio");
		expect(audio.headers.get(CommonHeaders.ContentType)).toBe("audio/mpeg");
	});

	it("normalizedContentType - video/mp4", () => {
		const video = ctReq("video/mp4");
		expect(Parser.getNormalizedContentType(video)).toBe("video");
		expect(video.headers.get(CommonHeaders.ContentType)).toBe("video/mp4");
	});

	it("normalizedContentType - unknown/something", () => {
		const unknown = ctReq("unknown/something");
		expect(Parser.getNormalizedContentType(unknown)).toBe("unknown");
		expect(unknown.headers.get(CommonHeaders.ContentType)).toBe(
			"unknown/something",
		);
	});

	it("normalizedContentType - no-body-allowed", () => {
		const noBodyAllowed = new HttpRequest(TEST_URL, { method: Method.GET });
		expect(Parser.getNormalizedContentType(noBodyAllowed)).toBe(
			"no-body-allowed",
		);
		expect(noBodyAllowed.headers.get(CommonHeaders.ContentType)).toBe(null);
	});
});

import { CommonHeaders, Cookies, Method } from "@/exports";
import { CoreumHeaders } from "@/internal/modules/CoreumHeaders/CoreumHeaders";
import { CoreumRequest } from "@/internal/modules/CoreumRequest/CoreumRequest";
import { describe, expect, it } from "bun:test";
import { TEST_URL } from "../constants/TEST_URL";

const ctReq = (ct: string) =>
	new CoreumRequest(TEST_URL, {
		method: Method.POST,
		headers: { [CommonHeaders.ContentType]: ct },
	});

describe("Request", () => {
	it("instances", () => {
		const req = new CoreumRequest(TEST_URL);
		expect(req.cookies).toBeInstanceOf(Cookies);
		expect(req.headers).toBeInstanceOf(CoreumHeaders);
		expect(req.method).toBe(Method.GET);
	});

	it("input is url", () => {
		const req = new CoreumRequest(TEST_URL);
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is url - Method", () => {
		const req = new CoreumRequest(TEST_URL, { method: Method.POST });
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.POST);
	});

	it("input is url - Headers", () => {
		const req = new CoreumRequest(TEST_URL, { headers: { test: "header" } });
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("input is Request", () => {
		const req = new CoreumRequest(new Request(TEST_URL));
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is Request - Method", () => {
		const req = new CoreumRequest(
			new Request(TEST_URL, { method: Method.POST }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.POST);
	});

	it("input is Request - Headers", () => {
		const req = new CoreumRequest(
			new Request(TEST_URL, { headers: { test: "header" } }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("input is CoreumRequest", () => {
		const req = new CoreumRequest(new CoreumRequest(TEST_URL));
		expect(req.url).toBe(`${TEST_URL}/`);
	});

	it("input is CoreumRequest - Method", () => {
		const req = new CoreumRequest(
			new CoreumRequest(TEST_URL, { method: Method.GET }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.method).toBe(Method.GET);
	});

	it("input is CoreumRequest - Headers", () => {
		const req = new CoreumRequest(
			new CoreumRequest(TEST_URL, { headers: { test: "header" } }),
		);
		expect(req.url).toBe(`${TEST_URL}/`);
		expect(req.headers.get("test")).toBe("header");
	});

	it("isPreflight", () => {
		const req = new CoreumRequest(TEST_URL, {
			method: Method.OPTIONS,
			headers: {
				[CommonHeaders.AccessControlRequestMethod]: Method.GET,
			},
		});
		expect(req.isPreflight).toBe(true);
	});
	it("normalizedContentType - application/json", () => {
		const json = ctReq("application/json");
		expect(json.normalizedContentType).toBe("json");
		expect(json.headers.get(CommonHeaders.ContentType)).toBe(
			"application/json",
		);
	});
	it("normalizedContentType - application/json; charset=utf-8", () => {
		const jsonCharset = ctReq("application/json; charset=utf-8");
		expect(jsonCharset.normalizedContentType).toBe("json");
		expect(jsonCharset.headers.get(CommonHeaders.ContentType)).toBe(
			"application/json; charset=utf-8",
		);
	});

	it("normalizedContentType - application/x-www-form-urlencoded", () => {
		const formUrlEncoded = ctReq("application/x-www-form-urlencoded");
		expect(formUrlEncoded.normalizedContentType).toBe("form-urlencoded");
		expect(formUrlEncoded.headers.get(CommonHeaders.ContentType)).toBe(
			"application/x-www-form-urlencoded",
		);
	});

	it("normalizedContentType - multipart/form-data", () => {
		const formData = ctReq("multipart/form-data");
		expect(formData.normalizedContentType).toBe("form-data");
		expect(formData.headers.get(CommonHeaders.ContentType)).toBe(
			"multipart/form-data",
		);
	});

	it("normalizedContentType - text/plain", () => {
		const text = ctReq("text/plain");
		expect(text.normalizedContentType).toBe("text");
		expect(text.headers.get(CommonHeaders.ContentType)).toBe("text/plain");
	});

	it("normalizedContentType - application/xml", () => {
		const appXml = ctReq("application/xml");
		expect(appXml.normalizedContentType).toBe("xml");
		expect(appXml.headers.get(CommonHeaders.ContentType)).toBe(
			"application/xml",
		);
	});

	it("normalizedContentType - text/xml", () => {
		const textXml = ctReq("text/xml");
		expect(textXml.normalizedContentType).toBe("xml");
		expect(textXml.headers.get(CommonHeaders.ContentType)).toBe("text/xml");
	});

	it("normalizedContentType - application/octet-stream", () => {
		const binary = ctReq("application/octet-stream");
		expect(binary.normalizedContentType).toBe("binary");
		expect(binary.headers.get(CommonHeaders.ContentType)).toBe(
			"application/octet-stream",
		);
	});

	it("normalizedContentType - application/pdf", () => {
		const pdf = ctReq("application/pdf");
		expect(pdf.normalizedContentType).toBe("pdf");
		expect(pdf.headers.get(CommonHeaders.ContentType)).toBe("application/pdf");
	});

	it("normalizedContentType - image/png", () => {
		const img = ctReq("image/png");
		expect(img.normalizedContentType).toBe("image");
		expect(img.headers.get(CommonHeaders.ContentType)).toBe("image/png");
	});

	it("normalizedContentType - audio/mpeg", () => {
		const audio = ctReq("audio/mpeg");
		expect(audio.normalizedContentType).toBe("audio");
		expect(audio.headers.get(CommonHeaders.ContentType)).toBe("audio/mpeg");
	});

	it("normalizedContentType - video/mp4", () => {
		const video = ctReq("video/mp4");
		expect(video.normalizedContentType).toBe("video");
		expect(video.headers.get(CommonHeaders.ContentType)).toBe("video/mp4");
	});

	it("normalizedContentType - unknown/something", () => {
		const unknown = ctReq("unknown/something");
		expect(unknown.normalizedContentType).toBe("unknown");
		expect(unknown.headers.get(CommonHeaders.ContentType)).toBe(
			"unknown/something",
		);
	});

	it("normalizedContentType - no-body-allowed", () => {
		const noBodyAllowed = new CoreumRequest(TEST_URL, { method: Method.GET });
		expect(noBodyAllowed.normalizedContentType).toBe("no-body-allowed");
		expect(noBodyAllowed.headers.get(CommonHeaders.ContentType)).toBe(null);
	});
});

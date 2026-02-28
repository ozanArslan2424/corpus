import C from "@/index";
import { describe, expect, it } from "bun:test";

describe("C.Response", () => {
	const ctHeader = C.CommonHeaders.ContentType;
	const otherHeader = "other-header";
	const otherHeaderValue = "other-header-value";
	const locHeader = C.CommonHeaders.Location;
	const locUrl = "/hello";

	async function expectData({
		res,
		response,
		data,
		expectedBody = "",
		expectedCtHeader = "text/plain",
		expectedStatus = C.Status.OK,
		expectedOK = true,
	}: {
		res: C.Response;
		response: Response;
		data: any;
		expectedBody?: any;
		expectedCtHeader?: string;
		expectedStatus?: number;
		expectedOK?: boolean;
	}) {
		// types and instances
		expect(res.headers).toBeInstanceOf(C.Headers);
		expect(res.cookies).toBeInstanceOf(C.Cookies);
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

	it("EMPTY BODY", async () => {
		const res = new C.Response();
		const response = res.response;
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
		});
	});

	it("NULL BODY", async () => {
		const res = new C.Response(null);
		const response = res.response;
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
		});
	});

	it("UNDEFINED BODY", async () => {
		const res = new C.Response(undefined);
		const response = res.response;
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
		});
	});

	it("REDIRECT BY INIT HEADERS", async () => {
		const res = new C.Response(undefined, { headers: [[locHeader, locUrl]] });
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - REDIRECT", async () => {
		const res = C.Response.redirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - REDIRECT - WITH EXTRA HEADERS", async () => {
		const res = C.Response.redirect(locUrl, {
			headers: [[otherHeader, otherHeaderValue]],
		});
		expect(res.headers.get(locHeader)).toBe(locUrl);
		expect(res.headers.get(otherHeader)).toBe(otherHeaderValue);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		expect(response.headers.get(otherHeader)).toBe(otherHeaderValue);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.FOUND,
		});
	});

	it("REDIRECT BY STATIC METHOD - PERMANENT REDIRECT", async () => {
		const res = C.Response.permanentRedirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.MOVED_PERMANENTLY,
		});
	});

	it("REDIRECT BY STATIC METHOD - TEMPORARY REDIRECT", async () => {
		const res = C.Response.temporaryRedirect(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.TEMPORARY_REDIRECT,
		});
	});

	it("REDIRECT BY STATIC METHOD - SEE OTHER", async () => {
		const res = C.Response.seeOther(locUrl);
		expect(res.headers.get(locHeader)).toBe(locUrl);
		const response = res.response;
		expect(response.headers.get(locHeader)).toBe(locUrl);
		const data = await response.text();
		await expectData({
			res,
			response,
			data,
			expectedOK: false,
			expectedStatus: C.Status.SEE_OTHER,
		});
	});
});

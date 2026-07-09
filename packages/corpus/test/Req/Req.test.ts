import { beforeEach, describe, expect, it } from "bun:test";

import { $registryTesting, TC } from "../_modules";

beforeEach(() => $registryTesting.reset());

describe("C.Req", () => {
	const urlString = "http://localhost:4444";
	const urlObject = new URL(urlString);
	const expectedUrlString = `${urlString}/`;
	const expectedUrlObject = new URL(expectedUrlString);

	function expectEmpty(req: TC.Req) {
		expect(req.init).toBeUndefined();
		expect(req.method).toBe("GET");
		expect(req.body).toBeNull();
		expect(req.url).toBe(expectedUrlString);
		expect(req.urlObject).toEqual(expectedUrlObject);
		expect(req.headers).toBeInstanceOf(Headers);
		expect(req.cookies).toBeInstanceOf(TC.Cookies);
		expect(req.isPreflight).toBeFalse();
	}

	it("EMPTY REQUEST - STRING URL INPUT", () => {
		const req = new TC.Req(urlString);
		expect(req.info).toBe(urlString);
		expect(req.info).toBeTypeOf("string");
		expectEmpty(req);
	});

	it("EMPTY REQUEST - URL OBJECT INPUT", () => {
		const req = new TC.Req(urlObject);
		expect(req.info).toBe(urlObject);
		expect(req.info).toBeInstanceOf(URL);
		expectEmpty(req);
	});

	it("EMPTY REQUEST - REQUEST OBJECT INPUT", () => {
		const request = new Request(urlObject);
		const req = new TC.Req(request);
		expect(req.info).toEqual(request);
		expect(req.info).toBeInstanceOf(Request);
		expectEmpty(req);
	});

	it.each(Object.values(TC.Method))("METHOD %s - STRING URL INPUT", (method) => {
		expect(new TC.Req(urlString, { method }).method).toBe(method);
	});

	it.each(Object.values(TC.Method))("METHOD %s - URL OBJECT INPUT", (method) => {
		expect(new TC.Req(urlObject, { method }).method).toBe(method);
	});

	it.each(Object.values(TC.Method))("METHOD %s - REQUEST OBJECT INPUT", (method) => {
		expect(new TC.Req(new Request(urlObject, { method })).method).toBe(method);
	});

	it("METHODS - REQUEST OBJECT INPUT OVERRIDE", () => {
		const values = Object.values(TC.Method);
		for (const [i, method] of values.entries()) {
			const nextMethod = i === values.length - 1 ? values[0] : values[i + 1];
			expect(
				new TC.Req(new Request(urlObject, { method }), {
					method: nextMethod,
				}).method,
			).toBe(nextMethod as string);
		}
	});

	const acrmHeader = TC.HeaderKey.AccessControlRequestMethod;

	it("PREFLIGHT - INIT HEADERS OBJECT", () => {
		const req = new TC.Req(urlString, {
			method: TC.Method.OPTIONS,
			headers: {
				[acrmHeader]: TC.Method.GET,
			},
		});
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(TC.Method.GET);
	});

	it("PREFLIGHT - INIT HEADERS HEADERS", () => {
		const headers = new Headers();
		headers.set(acrmHeader, TC.Method.GET);
		const req = new TC.Req(urlString, {
			method: TC.Method.OPTIONS,
			headers,
		});
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(TC.Method.GET);
	});

	it("PREFLIGHT - INIT HEADERS TUPLE ARRAY", () => {
		const req = new TC.Req(urlString, {
			method: TC.Method.OPTIONS,
			headers: [[acrmHeader, TC.Method.GET]],
		});
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(TC.Method.GET);
	});

	it("IS WEBSOCKET - TRUE WHEN UPGRADE HEADERS PRESENT", () => {
		const req = new TC.Req(urlString, {
			headers: {
				[TC.HeaderKey.Connection]: "upgrade",
				[TC.HeaderKey.Upgrade]: "websocket",
			},
		});
		expect(req.isWebsocket).toBeTrue();
	});

	it("IS WEBSOCKET - FALSE WITHOUT UPGRADE HEADER", () => {
		const req = new TC.Req(urlString, {
			headers: {
				[TC.HeaderKey.Upgrade]: "websocket",
			},
		});
		expect(req.isWebsocket).toBeFalse();
	});

	it("IS WEBSOCKET - FALSE WITHOUT WEBSOCKET HEADER", () => {
		const req = new TC.Req(urlString, {
			headers: {
				[TC.HeaderKey.Connection]: "upgrade",
			},
		});
		expect(req.isWebsocket).toBeFalse();
	});

	it("IS WEBSOCKET - CASE INSENSITIVE", () => {
		const req = new TC.Req(urlString, {
			headers: {
				[TC.HeaderKey.Connection]: "Upgrade",
				[TC.HeaderKey.Upgrade]: "WebSocket",
			},
		});
		expect(req.isWebsocket).toBeTrue();
	});

	it("IS WEBSOCKET - FALSE ON EMPTY REQUEST", () => {
		const req = new TC.Req(urlString);
		expect(req.isWebsocket).toBeFalse();
	});
});

import C from "@/index";
import { describe, expect, it } from "bun:test";

describe("C.Request", () => {
	const urlString = "http://localhost:4444";
	const urlObject = new URL(urlString);
	const expectedUrlString = `${urlString}/`;
	const expectedUrlObject = new URL(expectedUrlString);

	function expectEmpty(req: C.Request) {
		expect(req.init).toBeUndefined();
		expect(req.method).toBe("GET");
		expect(req.body).toBeNull();
		expect(req.url).toBe(expectedUrlString);
		expect(req.urlObject).toEqual(expectedUrlObject);
		expect(req.headers).toBeInstanceOf(C.Headers);
		expect(req.cookies).toBeInstanceOf(C.Cookies);
		expect(req.isPreflight).toBeFalse();
	}

	it("EMPTY REQUEST - STRING URL INPUT", () => {
		const req = new C.Request(urlString);
		expect(req.info).toBe(urlString);
		expect(req.info).toBeTypeOf("string");
		expectEmpty(req);
	});

	it("EMPTY REQUEST - URL OBJECT INPUT", () => {
		const req = new C.Request(urlObject);
		expect(req.info).toBe(urlObject);
		expect(req.info).toBeInstanceOf(URL);
		expectEmpty(req);
	});

	it("EMPTY REQUEST - REQUEST OBJECT INPUT", () => {
		const request = new Request(urlObject);
		const req = new C.Request(request);
		expect(req.info).toEqual(request);
		expect(req.info).toBeInstanceOf(Request);
		expectEmpty(req);
	});

	it.each(Object.values(C.Method))("METHOD %s - STRING URL INPUT", (method) => {
		expect(new C.Request(urlString, { method }).method).toBe(method);
	});

	it.each(Object.values(C.Method))("METHOD %s - URL OBJECT INPUT", (method) => {
		expect(new C.Request(urlObject, { method }).method).toBe(method);
	});

	it.each(Object.values(C.Method))(
		"METHOD %s - REQUEST OBJECT INPUT",
		(method) => {
			expect(new C.Request(new Request(urlObject, { method })).method).toBe(
				method,
			);
		},
	);

	it("METHODS - REQUEST OBJECT INPUT OVERRIDE", () => {
		const values = Object.values(C.Method);
		for (const [i, method] of values.entries()) {
			const nextMethod = i === values.length - 1 ? values[0] : values[i + 1];
			expect(
				new C.Request(new Request(urlObject, { method }), {
					method: nextMethod,
				}).method,
			).toBe(nextMethod as string);
		}
	});

	const acrmHeader = C.CommonHeaders.AccessControlRequestMethod;

	it("PREFLIGHT - INIT HEADERS OBJECT", () => {
		const req = new C.Request(urlString, {
			method: C.Method.OPTIONS,
			headers: {
				[acrmHeader]: C.Method.GET,
			},
		});
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(C.Method.GET);
	});

	it("PREFLIGHT - INIT HEADERS C.HEADERS", () => {
		const headers = new C.Headers();
		headers.set(acrmHeader, C.Method.GET);
		const req = new C.Request(urlString, { method: C.Method.OPTIONS, headers });
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(C.Method.GET);
	});

	it("PREFLIGHT - INIT HEADERS HEADERS", () => {
		const headers = new Headers();
		headers.set(acrmHeader, C.Method.GET);
		const req = new C.Request(urlString, { method: C.Method.OPTIONS, headers });
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(C.Method.GET);
	});

	it("PREFLIGHT - INIT HEADERS TUPLE ARRAY", () => {
		const req = new C.Request(urlString, {
			method: C.Method.OPTIONS,
			headers: [[acrmHeader, C.Method.GET]],
		});
		expect(req.isPreflight).toBe(true);
		expect(req.headers.get(acrmHeader)).toBe(C.Method.GET);
	});
});

import { describe, expect, it } from "bun:test";
import { reqMaker } from "../utils/reqMaker";
import { pathMaker } from "../utils/pathMaker";
import { CommonHeaders } from "@/internal/enums/CommonHeaders";
import { Status } from "@/internal/enums/Status";
import { Route } from "@/internal/modules/Route/Route";
import { Server } from "@/exports";

const s = new Server({});
const prefix = "/response-headers";
const path = pathMaker(prefix);
const req = reqMaker(prefix);

describe("Response Headers", () => {
	it("NULL", async () => {
		new Route({ method: "GET", path: path("/null") }, () => null);
		const res = await s.handle(req("/null", { method: "GET" }));
		expect(res.headers.get(CommonHeaders.ContentType)).toBe("text/plain");
		expect(await res.text()).toBe("");
	});

	it("UNDEFINED", async () => {
		new Route({ method: "GET", path: path("/undefined") }, () => null);
		const res = await s.handle(req("/undefined", { method: "GET" }));
		expect(res.headers.get(CommonHeaders.ContentType)).toBe("text/plain");
		expect(await res.text()).toBe("");
	});

	it("STRING", async () => {
		new Route({ method: "GET", path: path("/string") }, () => "hello world");
		const res = await s.handle(req("/string", { method: "GET" }));
		expect(res.headers.get(CommonHeaders.ContentType)).toBe("text/plain");
		expect(await res.text()).toBe("hello world");
	});

	it("OBJECT", async () => {
		new Route({ method: "GET", path: path("/object") }, () => ({
			hello: "world",
			object: "response",
		}));
		const res = await s.handle(req("/object", { method: "GET" }));
		expect(res.headers.get(CommonHeaders.ContentType)).toBe("application/json");
		expect(await res.json()).toEqual({
			hello: "world",
			object: "response",
		});
	});

	it("ArrayBuffer - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/ArrayBuffer") },
			() => new ArrayBuffer(),
		);
		const res = await s.handle(req("/ArrayBuffer", { method: "GET" }));
		expect(res.ok).toBe(false);
		expect(res.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	it("Blob - SHOULD FAIL", async () => {
		new Route({ method: "GET", path: path("/Blob") }, () => new Blob());
		const res = await s.handle(req("/Blob", { method: "GET" }));
		expect(res.ok).toBe(false);
		expect(res.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	it("FormData - SHOULD FAIL", async () => {
		new Route({ method: "GET", path: path("/FormData") }, () => new FormData());
		const res = await s.handle(req("/FormData", { method: "GET" }));
		expect(res.ok).toBe(false);
		expect(res.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	it("URLSearchParams - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/URLSearchParams") },
			() => new URLSearchParams(),
		);
		const res = await s.handle(req("/URLSearchParams", { method: "GET" }));
		expect(res.ok).toBe(false);
		expect(res.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	it("ReadableStream - SHOULD FAIL", async () => {
		new Route(
			{ method: "GET", path: path("/ReadableStream") },
			() => new ReadableStream(),
		);
		const res = await s.handle(req("/ReadableStream", { method: "GET" }));
		expect(res.ok).toBe(false);
		expect(res.status).toBe(Status.INTERNAL_SERVER_ERROR);
	});

	it("CONTENT-TYPE HEADER FOR JSON RESPONSES", async () => {
		new Route({ method: "GET", path: path("/header/json") }, () => ({
			json: "response",
		}));
		new Route(
			{ method: "GET", path: path("/header/string") },
			() => "string response",
		);
		new Route(
			{ method: "GET", path: path("/header/date") },
			() => new Date(Date.now()),
		);

		const resJson = await s.handle(req("/header/json", { method: "GET" }));
		const resString = await s.handle(req("/header/string", { method: "GET" }));
		const resDate = await s.handle(req("/header/date", { method: "GET" }));

		expect(resJson.headers.get(CommonHeaders.ContentType)).toContain(
			"application/json",
		);
		expect(resString.headers.get(CommonHeaders.ContentType)).toContain(
			"text/plain",
		);
		expect(resDate.headers.get(CommonHeaders.ContentType)).toContain(
			"text/plain",
		);
	});
});

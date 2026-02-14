import { CommonHeaders, Route, Status } from "@/exports";
import { ControllerAbstract } from "@/modules/Controller/ControllerAbstract";
import { HttpError } from "@/modules/HttpError/HttpError";
import { Parser } from "@/modules/Parser/Parser";
import { type } from "arktype";
import { describe, expect, it } from "bun:test";
import { testServer } from "test/utils/testServer";
import z from "zod";

const successData = { hello: 1 };
const failData = { unknown: "object" };
const successRouteData = {
	params: successData,
	search: successData,
	body: successData,
};
const failRouteData = {
	params: failData,
	search: failData,
	body: failData,
};

type ST = typeof successRouteData;

const arkBasic = type({ hello: "number" });

const zodBasic = z.object({ hello: z.number() });

class Model {
	static arkModelBasic = type({ hello: "number" });

	static zodModelBasic = z.object({ hello: z.number() });

	static arkReferenced = arkBasic;

	static zodReferenced = zodBasic;

	static arkRoute = {
		params: type({ hello: "number" }),
		search: type({ hello: "number" }),
		body: type({ hello: "number" }),
	};

	static zodRoute = {
		params: z.object({ hello: z.number() }),
		search: z.object({ hello: z.number() }),
		body: z.object({ hello: z.number() }),
	};

	static arkRouteReferenced = {
		params: this.arkModelBasic,
		search: this.arkRoute.search,
		body: arkBasic,
	};

	static zodRouteReferenced = {
		params: this.zodModelBasic,
		search: this.zodRoute.search,
		body: zodBasic,
	};

	static combined = {
		params: type({ hello: "number" }),
		search: z.object({ hello: z.number() }),
		body: this.arkRoute.body,
	};
}

class Controller extends ControllerAbstract {
	constructor() {
		super({ prefix: "/controller" });
	}

	arkRoute = this.route(
		{ method: "POST", path: "/arkRoute/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		Model.arkRoute,
	);
	arkRouteReferenced = this.route(
		{ method: "POST", path: "/arkRouteReferenced/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		Model.arkRouteReferenced,
	);
	zodRoute = this.route(
		{ method: "POST", path: "/zodRoute/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		Model.zodRoute,
	);
	zodRouteReferenced = this.route(
		{ method: "POST", path: "/zodRouteReferenced/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		Model.zodRouteReferenced,
	);
	combined = this.route(
		{ method: "POST", path: "/combined/:hello" },
		(c) => ({ body: c.body, params: c.params, search: c.search }),
		Model.combined,
	);

	// i'm having issues with this one
	optional = this.route("optional", (c) => c.search, {
		search: type({ "groupId?": "number | undefined" }),
	});
}

new Controller();

// prettier-ignore
describe("adaptive parsing based on library and schema definition", () => {
	it("arkBasic - variant", () => { expect(Parser.getParserVendor(arkBasic)).toBe("arktype"); });
	it("zodBasic - variant", () => { expect(Parser.getParserVendor(zodBasic)).toBe("zod"); });
	it("arkModelBasic - variant", () => { expect(Parser.getParserVendor(Model.arkModelBasic)).toBe("arktype"); });
	it("zodModelBasic - variant", () => { expect(Parser.getParserVendor(Model.zodModelBasic)).toBe("zod"); });
	it("arkReferenced - variant", () => { expect(Parser.getParserVendor(Model.arkReferenced)).toBe("arktype"); });
	it("zodReferenced - variant", () => { expect(Parser.getParserVendor(Model.zodReferenced)).toBe("zod"); });
	it("arkRoute - variant", () => { 
		expect(Parser.getParserVendor(Model.arkRoute.params)).toBe("arktype"); 
		expect(Parser.getParserVendor(Model.arkRoute.search)).toBe("arktype"); 
		expect(Parser.getParserVendor(Model.arkRoute.body)).toBe("arktype"); 
	});
	it("zodRoute - variant", () => { 
		expect(Parser.getParserVendor(Model.zodRoute.params)).toBe("zod"); 
		expect(Parser.getParserVendor(Model.zodRoute.search)).toBe("zod"); 
		expect(Parser.getParserVendor(Model.zodRoute.body)).toBe("zod"); 
	});
	it("arkRouteReferenced - variant", () => { 
		expect(Parser.getParserVendor(Model.arkRouteReferenced.params)).toBe("arktype"); 
		expect(Parser.getParserVendor(Model.arkRouteReferenced.search)).toBe("arktype"); 
		expect(Parser.getParserVendor(Model.arkRouteReferenced.body)).toBe("arktype"); 
	});
	it("zodRouteReferenced - variant", () => { 
		expect(Parser.getParserVendor(Model.zodRouteReferenced.params)).toBe("zod"); 
		expect(Parser.getParserVendor(Model.zodRouteReferenced.search)).toBe("zod"); 
		expect(Parser.getParserVendor(Model.zodRouteReferenced.body)).toBe("zod"); 
	});

	it("arkBasic - success", async () => { expect(await Parser.parse(successData, arkBasic)).toEqual(successData); });
	it("zodBasic - success", async () => { expect(await Parser.parse(successData, zodBasic)).toEqual(successData); });
	it("arkModelBasic - success", async () => { expect(await Parser.parse(successData, Model.arkModelBasic)).toEqual(successData); });
	it("zodModelBasic - success", async () => { expect(await Parser.parse(successData, Model.zodModelBasic)).toEqual(successData); });
	it("arkReferenced - success", async () => { expect(await Parser.parse(successData, Model.arkReferenced)).toEqual(successData); });
	it("zodReferenced - success", async () => { expect(await Parser.parse(successData, Model.zodReferenced)).toEqual(successData); });
	it("arkRoute - success", async () => { 
		expect(await Parser.parse(successRouteData.params, Model.arkRoute.params)).toEqual(successRouteData.params);
		expect(await Parser.parse(successRouteData.search, Model.arkRoute.search)).toEqual(successRouteData.search);
		expect(await Parser.parse(successRouteData.body, Model.arkRoute.body)).toEqual(successRouteData.body);
	});
	it("zodRoute - success", async () => { 
		expect(await Parser.parse(successRouteData.params, Model.zodRoute.params)).toEqual(successRouteData.params);
		expect(await Parser.parse(successRouteData.search, Model.zodRoute.search)).toEqual(successRouteData.search);
		expect(await Parser.parse(successRouteData.body, Model.zodRoute.body)).toEqual(successRouteData.body);
	});
	it("arkRouteReferenced - success", async () => { 
		expect(await Parser.parse(successRouteData.params, Model.arkRouteReferenced.params)).toEqual(successRouteData.params);
		expect(await Parser.parse(successRouteData.search, Model.arkRouteReferenced.search)).toEqual(successRouteData.search);
		expect(await Parser.parse(successRouteData.body, Model.arkRouteReferenced.body)).toEqual(successRouteData.body);
	});
	it("zodRouteReferenced - success", async () => { 
		expect(await Parser.parse(successRouteData.params, Model.zodRouteReferenced.params)).toEqual(successRouteData.params);
		expect(await Parser.parse(successRouteData.search, Model.zodRouteReferenced.search)).toEqual(successRouteData.search);
		expect(await Parser.parse(successRouteData.body, Model.zodRouteReferenced.body)).toEqual(successRouteData.body);
	});
	it("arkRoute - Real Request - success", async ()=>{
		new Route({ method: "POST", path: "/success/arkRoute/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.arkRoute)
		const url = new URL(`http://localhost:3000/success/arkRoute/hello/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})
	it("zodRoute - Real Request - success", async ()=>{
		new Route({ method: "POST", path: "/success/zodRoute/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.zodRoute)
		const url = new URL(`http://localhost:3000/success/zodRoute/hello/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})
	it("arkRouteReferenced - Real Request - success", async ()=>{
		new Route({ method: "POST", path: "/success/arkRouteReferenced/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.arkRouteReferenced)
		const url = new URL(`http://localhost:3000/success/arkRouteReferenced/hello/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})
	it("zodRouteReferenced - Real Request - success", async ()=>{
		new Route({ method: "POST", path: "/success/zodRouteReferenced/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.zodRouteReferenced)
		const url = new URL(`http://localhost:3000/success/zodRouteReferenced/hello/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})
	it("combined - Real Request - success", async ()=>{
		new Route({ method: "POST", path: "/success/combined/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.combined)
		const url = new URL(`http://localhost:3000/success/combined/hello/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})
	it("Controller - Real Request - success", async ()=>{
		const url = new URL(`http://localhost:3000/controller/combined/${successRouteData.params.hello}`)
		url.searchParams.set("hello", successRouteData.search.hello.toString())
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(successRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(await Parser.getBody<ST>(res)).toEqual(successRouteData)
	})


	it("arkBasic - fail", () => { expect(async() => await Parser.parse(failData, arkBasic)).toThrow(HttpError); });
	it("zodBasic - fail", () => { expect(async() => await Parser.parse(failData, zodBasic)).toThrow(HttpError); });
	it("arkModelBasic - fail", () => { expect(async() => await Parser.parse(failData, Model.arkModelBasic)).toThrow(HttpError); });
	it("zodModelBasic - fail", () => { expect(async() => await Parser.parse(failData, Model.zodModelBasic)).toThrow(HttpError); });
	it("arkReferenced - fail", () => { expect(async() => await Parser.parse(failData, Model.arkReferenced)).toThrow(HttpError); });
	it("zodReferenced - fail", () => { expect(async() => await Parser.parse(failData, Model.zodReferenced)).toThrow(HttpError); });
	it("arkRoute - fail", () => { 
		expect(async()=>await Parser.parse(failRouteData.params, Model.arkRoute.params)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.search, Model.arkRoute.search)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.body, Model.arkRoute.body)).toThrow(HttpError);
	});
	it("zodRoute - fail", () => { 
		expect(async()=>await Parser.parse(failRouteData.params, Model.zodRoute.params)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.search, Model.zodRoute.search)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.body, Model.zodRoute.body)).toThrow(HttpError);
	});
	it("arkRouteReferenced - fail", () => { 
		expect(async()=>await Parser.parse(failRouteData.params, Model.arkRouteReferenced.params)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.search, Model.arkRouteReferenced.search)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.body, Model.arkRouteReferenced.body)).toThrow(HttpError);
	});
	it("zodRouteReferenced - fail", () => { 
		expect(async()=>await Parser.parse(failRouteData.params, Model.zodRouteReferenced.params)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.search, Model.zodRouteReferenced.search)).toThrow(HttpError);
		expect(async()=>await Parser.parse(failRouteData.body, Model.zodRouteReferenced.body)).toThrow(HttpError);
	});
	it("arkRoute - Real Request - fail", async ()=>{
		new Route({ method: "POST", path: "/fail/arkRoute/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.arkRoute)
		const url = new URL(`http://localhost:3000/fail/arkRoute/hello/${failRouteData.params.unknown}`)
		url.searchParams.set("unknown", failRouteData.search.unknown)
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(failRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(res.ok).toBe(false)
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY)
	})
	it("zodRoute - Real Request - fail", async ()=>{
		new Route({ method: "POST", path: "/fail/zodRoute/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.zodRoute)
		const url = new URL(`http://localhost:3000/fail/zodRoute/hello/${failRouteData.params.unknown}`)
		url.searchParams.set("unknown", failRouteData.search.unknown)
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(failRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(res.ok).toBe(false)
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY)
	})
	it("arkRouteReferenced - Real Request - fail", async ()=>{
		new Route({ method: "POST", path: "/fail/arkRouteReferenced/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.arkRouteReferenced)
		const url = new URL(`http://localhost:3000/fail/arkRouteReferenced/hello/${failRouteData.params.unknown}`)
		url.searchParams.set("unknown", failRouteData.search.unknown)
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(failRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(res.ok).toBe(false)
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY)
	})
	it("zodRouteReferenced - Real Request - fail", async ()=>{
		new Route({ method: "POST", path: "/fail/zodRouteReferenced/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.zodRouteReferenced)
		const url = new URL(`http://localhost:3000/fail/zodRouteReferenced/hello/${failRouteData.params.unknown}`)
		url.searchParams.set("unknown", failRouteData.search.unknown)
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(failRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(res.ok).toBe(false)
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY)
	})
	it("combined - Real Request - fail", async ()=>{
		new Route({ method: "POST", path: "/fail/combined/hello/:hello" }, (c) => ({ body:c.body, params: c.params, search: c.search }), Model.combined)
		const url = new URL(`http://localhost:3000/fail/combined/hello/${failRouteData.params.unknown}`)
		url.searchParams.set("unknown", failRouteData.search.unknown)
		const res = await testServer.handle(new Request(url, { body: JSON.stringify(failRouteData.body), method:"POST", headers: { [CommonHeaders.ContentType]: "application/json" } }))
		expect(res.ok).toBe(false)
		expect(res.status).toBe(Status.UNPROCESSABLE_ENTITY)
	})

	it("optional - provided", async ()=>{
		const url = new URL("http://localhost:3000/controller/optional")
		url.searchParams.set("groupId", "8")
		const res = await testServer.handle(new Request(url))
		expect(await Parser.getBody<{groupId: number}>(res)).toEqual({groupId: 8})
	})

	it("optional - missing", async ()=>{
		const url = new URL("http://localhost:3000/controller/optional")
		const res = await testServer.handle(new Request(url))
		const body = await Parser.getBody<{}>(res)
		expect(Object.keys(body).length).toBe(0)
	})
});

import { beforeAll, describe, expect, test } from "bun:test";

import { z } from "zod";

import { getContextAccess } from "@/Context/ContextAccess";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";

beforeAll(() => {
	initialize();
	Globals.set("apps", []);
});

const none = {
	body: false,
	search: false,
	params: false,
	data: false,
	server: false,
	req: false,
	res: false,
	url: false,
	reqBody: false,
};

const all = {
	body: true,
	search: true,
	params: true,
	data: true,
	server: true,
	req: true,
	res: true,
	url: true,
	reqBody: true,
};

describe("getContextAccess", () => {
	describe("signature parsing", () => {
		test("should read the first parameter past a second one", () => {
			const access = getContextAccess([(c: any, next: any) => [c.body, next]], undefined);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});

		test("should not end the first parameter at a comma nested in a pattern", () => {
			const access = getContextAccess([({ body }: any, next: any) => [body, next]], undefined);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});

		test("should not end the first parameter at a comma inside a string default", () => {
			const access = getContextAccess([(c = ",") => (c as any).search], undefined);
			expect(access).toEqual({ ...none, body: false, search: true, params: false });
		});

		test("should not end a string default at an escaped quote", () => {
			const access = getContextAccess([(c = '\\"') => (c as any).params], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should read a parenless arrow parameter", () => {
			const handler: (c: any) => unknown = (c) => c.body;
			const access = getContextAccess([handler], undefined);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});

		test("should read an async parenless arrow parameter", () => {
			const handler: (c: any) => unknown = async (c) => c.search;
			const access = getContextAccess([handler], undefined);
			expect(access).toEqual({ ...none, body: false, search: true, params: false });
		});

		test("should read a function expression parameter", () => {
			const access = getContextAccess(
				[
					function (c: any) {
						return c.params;
					},
				],
				undefined,
			);
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should read a method shorthand parameter", () => {
			const controller = {
				handle(c: { body: unknown }) {
					return c.body;
				},
			};
			const access = getContextAccess([controller.handle], undefined);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});
	});

	describe("destructured parameter", () => {
		test("should report only the keys named in the pattern", () => {
			const access = getContextAccess([({ body, search }: any) => [body, search]], undefined);
			expect(access).toEqual({ ...none, body: true, search: true, params: false });
		});

		test("should report a renamed binding", () => {
			const access = getContextAccess([({ params: p }: any) => p], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should report a binding carrying a default value", () => {
			const access = getContextAccess([({ search = {} }: any) => search], undefined);
			expect(access).toEqual({ ...none, body: false, search: true, params: false });
		});

		test("should report no access for an empty pattern", () => {
			// oxlint-disable-next-line no-empty-pattern
			const access = getContextAccess([({}: any) => "ok"], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should not report a key whose name only prefixes a bound property", () => {
			const access = getContextAccess([({ bodyParser }: any) => bodyParser], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should report every key when the pattern has a rest element", () => {
			const access = getContextAccess([({ body, ...rest }: any) => [body, rest]], undefined);
			expect(access).toEqual(all);
		});
	});

	describe("property reads", () => {
		test("should report an optionally chained read", () => {
			const access = getContextAccess([(c: any) => c?.body], undefined);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});

		test("should report a bracketed read with a literal key", () => {
			const access = getContextAccess([(c: any) => c["search"]], undefined);
			expect(access).toEqual({ ...none, body: false, search: true, params: false });
		});

		test("should report a spread of a single property", () => {
			const access = getContextAccess([(c: any) => ({ ...c.params })], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should not report a read of a property outside the tracked keys", () => {
			const access = getContextAccess([(c: any) => c.headers], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should not report a property that merely shares the parameter's name", () => {
			const outer = { _c: { body: "" } };
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => outer._c.body], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should not report a longer identifier that starts with the parameter's name", () => {
			const _context = { body: "" };
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => _context.body], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should report no access when the parameter is never mentioned", () => {
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});
	});

	describe("destructuring assignment in the body", () => {
		test("should report the keys named by a pattern assigned from the context", () => {
			const access = getContextAccess(
				[
					(c: any) => {
						const { body, params } = c;
						return [body, params];
					},
				],
				undefined,
			);
			expect(access).toEqual({ ...none, body: true, search: false, params: true });
		});

		test("should report every key when an assigned pattern has a rest element", () => {
			const access = getContextAccess(
				[
					(c: any) => {
						const { search, ...rest } = c;
						return [search, rest];
					},
				],
				undefined,
			);
			expect(access).toEqual(all);
		});
	});

	describe("inlined bindings", () => {
		test("should report only the read key when a literal index key is inlined", () => {
			const key = "params";
			const access = getContextAccess([(c: any) => c[key]], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should report only the read key when an alias binding is inlined", () => {
			const access = getContextAccess(
				[
					(c: any) => {
						const alias = c;
						return alias.body;
					},
				],
				undefined,
			);
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});
	});

	describe("escaping context", () => {
		test("should report every key when the context is passed to another function", () => {
			const doWork = (value: unknown) => value;
			const access = getContextAccess([(c: any) => doWork(c)], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key when the context is returned", () => {
			const access = getContextAccess(
				[
					(c: any) => {
						return c;
					},
				],
				undefined,
			);
			expect(access).toEqual(all);
		});

		test("should report every key when the context is compared as a value", () => {
			const other = {};
			const access = getContextAccess([(c: any) => c === other], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key when the whole context is spread", () => {
			const access = getContextAccess([(c: any) => ({ ...c })], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key when the context is indexed with a computed key", () => {
			const key = () => "body";
			const access = getContextAccess([(c: any) => c[key()]], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key when the context escapes after a tracked read", () => {
			const doWork = (value: unknown) => value;
			const access = getContextAccess(
				[
					(c: any) => {
						const a = c.body;
						return [a, doWork(c)];
					},
				],
				undefined,
			);
			expect(access).toEqual(all);
		});
	});

	describe("unanalyzable handlers", () => {
		test("should report every key for a native function", () => {
			const access = getContextAccess([Math.max], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key for a bound function", () => {
			const handler = ((c: { body: unknown }) => c.body).bind(null);
			const access = getContextAccess([handler], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key when no parameter list can be located", () => {
			const access = getContextAccess([class Handler {}], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key for a handler taking no parameters", () => {
			const access = getContextAccess([() => "ok"], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key for an array pattern parameter", () => {
			const access = getContextAccess([([first]: any) => first], undefined);
			expect(access).toEqual(all);
		});

		test("should report every key for a rest parameter", () => {
			const access = getContextAccess([(...args: Array<unknown>) => args], undefined);
			expect(access).toEqual(all);
		});
	});

	describe("union across handlers", () => {
		test("should union the keys read by each handler", () => {
			const access = getContextAccess([(c: any) => c.body, (c: any) => c.search], undefined);
			expect(access).toEqual({ ...none, body: true, search: true, params: false });
		});

		test("should report every key when any handler is unanalyzable", () => {
			const access = getContextAccess([(c: any) => c.body, Math.max], undefined);
			expect(access).toEqual(all);
		});

		test("should report no access for an empty handler list", () => {
			const access = getContextAccess([], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});

		test("should not let one call's result leak into the next", () => {
			getContextAccess([Math.max], undefined);
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], undefined);
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});
	});

	describe("config", () => {
		test("should report body when a body schema is configured", () => {
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], { body: z.object({}) });
			expect(access).toEqual({ ...none, body: true, search: false, params: false });
		});

		test("should report search when a search schema is configured", () => {
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], { search: z.object({}) });
			expect(access).toEqual({ ...none, body: false, search: true, params: false });
		});

		test("should report params when a params schema is configured", () => {
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], { params: z.object({}) });
			expect(access).toEqual({ ...none, body: false, search: false, params: true });
		});

		test("should not report a key for an unrelated config entry", () => {
			// oxlint-disable-next-line no-unused-vars
			const access = getContextAccess([(_c: any) => "ok"], { maxRequestBodySize: 1024 });
			expect(access).toEqual({ ...none, body: false, search: false, params: false });
		});
	});
});

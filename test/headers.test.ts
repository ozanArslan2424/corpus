import C from "@/index";
import { describe, expect, it } from "bun:test";

describe("C.Headers", () => {
	const authHeader = C.CommonHeaders.Authorization;
	const authValue = "Bearer 1827381273";
	const contHeader = C.CommonHeaders.ContentType;
	const contValue = "application/json";

	function expectMethods(
		headers: C.Headers,
		count: number = 1,
		value: string = authValue,
		obj: Record<string, string> = { [authHeader.toLowerCase()]: authValue },
	) {
		expect(headers.count).toBe(count);
		expect(headers.get(authHeader)).toBe(value);
		expect(headers.has(authHeader)).toBeTrue();
		expect(headers.toJSON()).toEqual(obj);
		headers.delete(authHeader);
		expect(headers.count).toBe(count - 1);
		expect(headers.get(authHeader)).toBeNull();
		expect(headers.has(authHeader)).toBeFalse();
		if (count - 1 === 0) {
			expect(headers.toJSON()).toBeEmptyObject();
		}
		// No need to overcomplicate by adding an else statement,
		// this is just for method testing
	}

	it("INIT - OBJECT", () => {
		const headers = new C.Headers({ [authHeader]: authValue });
		expectMethods(headers);
	});

	it("INIT - TUPLE ARRAY", () => {
		const headers = new C.Headers([[authHeader, authValue]]);
		expectMethods(headers);
	});

	it("INIT - C.HEADERS - INNER INIT OBJECT", () => {
		const headers = new C.Headers(new C.Headers({ [authHeader]: authValue }));
		expectMethods(headers);
	});

	it("INIT - C.HEADERS - INNER INIT TUPLE ARRAY", () => {
		const headers = new C.Headers(new C.Headers([[authHeader, authValue]]));
		expectMethods(headers);
	});

	it("INIT - HEADERS - INNER INIT OBJECT", () => {
		const headers = new C.Headers(new Headers({ [authHeader]: authValue }));
		expectMethods(headers);
	});

	it("INIT - HEADERS - INNER INIT TUPLE ARRAY", () => {
		const headers = new C.Headers(new Headers([[authHeader, authValue]]));
		expectMethods(headers);
	});

	it("SET", () => {
		const headers = new C.Headers();
		headers.set(authHeader, authValue);
		expectMethods(headers);
	});

	it("APPEND - EMPTY", () => {
		const headers = new C.Headers();
		headers.append(authHeader, authValue);
		expectMethods(headers);
	});

	it("APPEND - EXISTING", () => {
		const initialValue = "initial value";
		const expectedValue = `${initialValue}, ${authValue}`;
		const headers = new C.Headers();
		headers.set(authHeader, initialValue);
		headers.append(authHeader, authValue);
		expectMethods(headers, 1, expectedValue, {
			[authHeader.toLowerCase()]: expectedValue,
		});
	});

	it("SETMANY - OBJECT INIT", () => {
		const headers = new C.Headers();
		headers.setMany({
			[authHeader]: authValue,
			[contHeader]: contValue,
		});
		expectMethods(headers, 2, authValue, {
			[authHeader.toLowerCase()]: authValue,
			[contHeader.toLowerCase()]: contValue,
		});
	});

	it("SETMANY - TUPLE ARRAY INIT", () => {
		const headers = new C.Headers();
		headers.setMany([
			[authHeader, authValue],
			[contHeader, contValue],
		]);
		expectMethods(headers, 2, authValue, {
			[authHeader.toLowerCase()]: authValue,
			[contHeader.toLowerCase()]: contValue,
		});
	});

	it("COMBINE - WITH EMPTY", () => {
		const source = new C.Headers({ [authHeader]: authValue });
		const target = new C.Headers();
		const combined = C.Headers.combine(source, target);
		expectMethods(combined);
	});

	it("COMBINE - WITH ADDITION", () => {
		const source = new C.Headers({ [authHeader]: authValue });
		const target = new C.Headers({ [contHeader]: contValue });
		const combined = C.Headers.combine(source, target);
		expectMethods(combined, 2, authValue, {
			[authHeader.toLowerCase()]: authValue,
			[contHeader.toLowerCase()]: contValue,
		});
	});

	const overrideValue = "override";

	it("COMBINE - WITH OVERRIDE", () => {
		const source = new C.Headers({ [authHeader]: overrideValue });
		const target = new C.Headers({ [authHeader]: authValue });
		const combined = C.Headers.combine(source, target);
		expectMethods(combined, 1, overrideValue, {
			[authHeader.toLowerCase()]: overrideValue,
		});
	});

	it("INNERCOMBINE - WITH EMPTY", () => {
		const source = new C.Headers({ [authHeader]: authValue });
		const target = new C.Headers();
		target.innerCombine(source);
		expectMethods(target);
	});

	it("INNERCOMBINE - WITH ADDITION", () => {
		const source = new C.Headers({ [authHeader]: authValue });
		const target = new C.Headers({ [contHeader]: contValue });
		target.innerCombine(source);
		expectMethods(target, 2, authValue, {
			[authHeader.toLowerCase()]: authValue,
			[contHeader.toLowerCase()]: contValue,
		});
	});

	it("INNERCOMBINE - WITH OVERRIDE", () => {
		const source = new C.Headers({ [authHeader]: overrideValue });
		const target = new C.Headers({ [authHeader]: authValue });
		target.innerCombine(source);
		expectMethods(target, 1, overrideValue, {
			[authHeader.toLowerCase()]: overrideValue,
		});
	});
});

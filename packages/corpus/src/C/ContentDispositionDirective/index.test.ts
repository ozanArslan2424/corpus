import { describe, expect, it } from "bun:test";

import { C } from "#corpus";

describe("ContentDispositionDirective", () => {
	describe("createHeaderString", () => {
		it("serializes disposition", () => {
			expect(C.ContentDispositionDirective.createHeaderString({ disposition: "inline" })).toBe(
				"inline",
			);
		});

		it("serializes combination", () => {
			expect(
				C.ContentDispositionDirective.createHeaderString({
					disposition: "inline",
					filename: "test.test",
				}),
			).toBe('inline; filename="test.test"');
		});
	});

	describe("applyHeader", () => {
		it("sets the content disposition header", () => {
			const headers = new Headers();
			C.ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "report.pdf",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="report.pdf"');
		});

		it("returns the same headers instance", () => {
			const headers = new Headers();
			const returned = C.ContentDispositionDirective.applyHeader(headers, {
				disposition: "inline",
			});
			expect(returned).toBe(headers);
		});

		it("overwrites an existing header", () => {
			const headers = new Headers({ "content-disposition": "inline" });
			C.ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "file.txt",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="file.txt"');
		});
	});

	describe("constructor", () => {
		it("assigns opts to the instance", () => {
			const directive = new C.ContentDispositionDirective({
				disposition: "attachment",
				filename: "a.txt",
			});
			expect(directive.disposition).toBe("attachment");
			expect(directive.filename).toBe("a.txt");
		});

		it("instance works with createheaderstring", () => {
			const directive = new C.ContentDispositionDirective({ disposition: "inline" });
			expect(C.ContentDispositionDirective.createHeaderString(directive)).toBe("inline");
		});
	});
});

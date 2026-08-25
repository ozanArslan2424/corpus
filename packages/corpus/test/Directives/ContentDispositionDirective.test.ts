import { describe, expect, it } from "bun:test";

import { TC } from "../_modules";

describe("ContentDispositionDirective", () => {
	describe("createHeaderString", () => {
		it("serializes disposition", () => {
			expect(TC.ContentDispositionDirective.createHeaderString({ disposition: "inline" })).toBe(
				"inline",
			);
		});

		it("serializes combination", () => {
			expect(
				TC.ContentDispositionDirective.createHeaderString({
					disposition: "inline",
					filename: "test.test",
				}),
			).toBe('inline; filename="test.test"');
		});
	});

	describe("applyHeader", () => {
		it("sets the content disposition header", () => {
			const headers = new Headers();
			TC.ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "report.pdf",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="report.pdf"');
		});

		it("returns the same headers instance", () => {
			const headers = new Headers();
			const returned = TC.ContentDispositionDirective.applyHeader(headers, {
				disposition: "inline",
			});
			expect(returned).toBe(headers);
		});

		it("overwrites an existing header", () => {
			const headers = new Headers({ "content-disposition": "inline" });
			TC.ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "file.txt",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="file.txt"');
		});
	});

	describe("constructor", () => {
		it("assigns opts to the instance", () => {
			const directive = new TC.ContentDispositionDirective({
				disposition: "attachment",
				filename: "a.txt",
			});
			expect(directive.disposition).toBe("attachment");
			expect(directive.filename).toBe("a.txt");
		});

		it("instance works with createheaderstring", () => {
			const directive = new TC.ContentDispositionDirective({ disposition: "inline" });
			expect(TC.ContentDispositionDirective.createHeaderString(directive)).toBe("inline");
		});
	});
});

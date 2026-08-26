import { afterEach, describe, expect, it } from "bun:test";

import { ContentDispositionDirective } from "@/C/ContentDispositionDirective/ContentDispositionDirective";
import { $registry } from "@/Registry";

afterEach(() => $registry.reset());

describe("ContentDispositionDirective", () => {
	describe("createHeaderString", () => {
		it("serializes disposition", () => {
			expect(ContentDispositionDirective.createHeaderString({ disposition: "inline" })).toBe(
				"inline",
			);
		});

		it("serializes combination", () => {
			expect(
				ContentDispositionDirective.createHeaderString({
					disposition: "inline",
					filename: "test.test",
				}),
			).toBe('inline; filename="test.test"');
		});
	});

	describe("applyHeader", () => {
		it("sets the content disposition header", () => {
			const headers = new Headers();
			ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "report.pdf",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="report.pdf"');
		});

		it("returns the same headers instance", () => {
			const headers = new Headers();
			const returned = ContentDispositionDirective.applyHeader(headers, {
				disposition: "inline",
			});
			expect(returned).toBe(headers);
		});

		it("overwrites an existing header", () => {
			const headers = new Headers({ "content-disposition": "inline" });
			ContentDispositionDirective.applyHeader(headers, {
				disposition: "attachment",
				filename: "file.txt",
			});
			expect(headers.get("content-disposition")).toBe('attachment; filename="file.txt"');
		});
	});

	describe("constructor", () => {
		it("assigns opts to the instance", () => {
			const directive = new ContentDispositionDirective({
				disposition: "attachment",
				filename: "a.txt",
			});
			expect(directive.disposition).toBe("attachment");
			expect(directive.filename).toBe("a.txt");
		});

		it("instance works with createheaderstring", () => {
			const directive = new ContentDispositionDirective({ disposition: "inline" });
			expect(ContentDispositionDirective.createHeaderString(directive)).toBe("inline");
		});
	});
});

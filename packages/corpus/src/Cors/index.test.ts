import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Context } from "@/Context";
import { Cors } from "@/Cors";
import { Globals } from "@/Globals";
import { HeaderKey } from "@/Headers";
import { Status } from "@/Res";

beforeEach(() => {
	// Cors.register() calls getNearestApp(), which throws without an active App.
	Globals.set("apps", []);
	new App();
});

afterEach(() => {
	Globals.delete("apps");
});

function makeContext(origin?: string) {
	return new Context<never, never, never, never>(
		new Request("http://localhost/", origin ? { headers: { origin } } : {}),
		undefined,
	);
}

describe("Cors", () => {
	describe("construction", () => {
		it("stores the provided opts", () => {
			const opts = { allowedOrigins: ["https://example.com"] };
			const cors = new Cors(opts);
			expect(cors.opts).toBe(opts);
		});

		it("leaves opts undefined when not provided", () => {
			const cors = new Cors();
			expect(cors.opts).toBeUndefined();
		});

		it("registers itself onto the nearest App's cors field", () => {
			const app = new App();
			const cors = new Cors();
			expect(app.cors).toBe(cors);
		});
	});

	describe("handler: origin handling", () => {
		it("allows any origin with '*' when no allowedOrigins is configured", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("*");
		});

		it("does not set a Vary header for the plain wildcard case", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBeNull();
		});

		it("reflects the actual origin (not '*') when credentials is true and a wildcard is configured", () => {
			const cors = new Cors({ credentials: true });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("https://example.com");
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("falls back to '*' when credentials is true but no origin header is present", () => {
			// reqOrigin is falsy here, so the credentials+wildcard reflection branch
			// is skipped and it falls through to the plain wildcard case instead -
			// even though Allow-Credentials will still be set to true below.
			const cors = new Cors({ credentials: true });
			const ctx = makeContext();
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("*");
		});

		it("sets the specific origin and Vary header when it is in the allowed list", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com", "https://other.com"] });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("https://example.com");
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("does not set an Allow-Origin header when the origin is not in the allowed list", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext("https://not-allowed.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBeNull();
		});

		it("treats an explicit '*' entry in allowedOrigins as a wildcard", () => {
			const cors = new Cors({ allowedOrigins: ["*"] });
			const ctx = makeContext("https://anything.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("*");
		});
	});

	describe("handler: other headers", () => {
		it("sets Allow-Methods when allowedMethods is configured", () => {
			const cors = new Cors({ allowedMethods: ["GET", "POST"] });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowMethods)).toBe("GET, POST");
		});

		it("does not set Allow-Methods when not configured", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowMethods)).toBeNull();
		});

		it("sets Allow-Headers when allowedHeaders is configured", () => {
			const cors = new Cors({ allowedHeaders: [HeaderKey.ContentType, HeaderKey.Authorization] });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowHeaders)).toBe(
				`${HeaderKey.ContentType}, ${HeaderKey.Authorization}`,
			);
		});

		it("sets Expose-Headers when exposedHeaders is configured", () => {
			const cors = new Cors({ exposedHeaders: [HeaderKey.ContentLength] });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlExposeHeaders)).toBe(
				HeaderKey.ContentLength,
			);
		});

		it("does not set Max-Age on the regular handler even if maxAge is configured", () => {
			const cors = new Cors({ maxAge: 60 });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlMaxAge)).toBeNull();
		});

		it("sets Allow-Credentials to 'true' when credentials is true", () => {
			const cors = new Cors({ credentials: true });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowCredentials)).toBe("true");
		});

		it("sets Allow-Credentials to 'false' when credentials is not configured", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowCredentials)).toBe("false");
		});
	});

	describe("handlePreflight", () => {
		it("returns a Res with status 204", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx);
			expect(result).toHaveProperty("status", Status.NO_CONTENT);
		});

		it("applies the same origin/credentials logic as the regular handler", () => {
			const cors = new Cors({ credentials: true });
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx) as { headers: Headers };
			expect(result.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("https://example.com");
			expect(result.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("sets Max-Age using the default of 86400 when not configured", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx) as { headers: Headers };
			expect(result.headers.get(HeaderKey.AccessControlMaxAge)).toBe("86400");
		});

		it("sets Max-Age using a custom configured value", () => {
			const cors = new Cors({ maxAge: 120 });
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx) as { headers: Headers };
			expect(result.headers.get(HeaderKey.AccessControlMaxAge)).toBe("120");
		});

		it("does not mutate the context's own response object", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx);
			expect(result).not.toBe(ctx.res);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBeNull();
		});
	});
});

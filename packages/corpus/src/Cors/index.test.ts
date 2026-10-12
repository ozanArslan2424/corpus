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
			expect(cors.options).toBe(opts);
		});

		it("leaves opts undefined when not provided", () => {
			const cors = new Cors();
			expect(cors.options).toBeUndefined();
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

		it("sends '*' rather than reflecting the caller when credentials is set on a wildcard", () => {
			// Reflecting whatever origin was sent would make a credentialed
			// response readable by any site. The wildcard goes out instead and
			// the browser rejects the combination, which is what express,
			// fastify and Hono all do.
			const cors = new Cors({ credentials: true });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("*");
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBeNull();
		});

		it("sends '*' for a wildcard policy with credentials and no origin header", () => {
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

		it("varies on origin even when the origin is rejected", () => {
			// The response differs by origin whether or not it was allowed, so a
			// shared cache that did not key on it could serve one origin's
			// response to another.
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext("https://not-allowed.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("varies on origin for a restricted policy when no origin was sent", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext();
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowOrigin)).toBeNull();
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("does not duplicate Origin in a Vary header that already lists it", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext("https://example.com");
			ctx.res.headers.set(HeaderKey.Vary, "Accept-Encoding, Origin");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Accept-Encoding, Origin");
		});

		it("leaves a 'Vary: *' alone, since it already covers the origin", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext("https://example.com");
			ctx.res.headers.set(HeaderKey.Vary, "*");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("*");
		});

		it("appends Origin to a Vary header that does not already list it", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"] });
			const ctx = makeContext("https://example.com");
			ctx.res.headers.set(HeaderKey.Vary, "Accept-Encoding");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.Vary)).toBe("Accept-Encoding, Origin");
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

		it("omits Allow-Credentials when credentials is not configured", () => {
			// A browser reads the header set to "false" exactly as it reads the
			// header being absent, so sending it is noise on every response.
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowCredentials)).toBeNull();
		});

		it("omits Allow-Credentials when credentials is explicitly false", () => {
			const cors = new Cors({ credentials: false });
			const ctx = makeContext("https://example.com");
			cors.handler(ctx);
			expect(ctx.res.headers.get(HeaderKey.AccessControlAllowCredentials)).toBeNull();
		});
	});

	describe("handlePreflight", () => {
		it("returns a Res with status 204", () => {
			const cors = new Cors();
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx);
			expect(result).toHaveProperty("status", Status.NO_CONTENT);
		});

		it("applies the same origin logic as the regular handler", () => {
			const cors = new Cors({ allowedOrigins: ["https://example.com"], credentials: true });
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx) as { headers: Headers };
			expect(result.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("https://example.com");
			expect(result.headers.get(HeaderKey.AccessControlAllowCredentials)).toBe("true");
			expect(result.headers.get(HeaderKey.Vary)).toBe("Origin");
		});

		it("sends '*' for a wildcard policy with credentials, as the handler does", () => {
			const cors = new Cors({ credentials: true });
			const ctx = makeContext("https://example.com");
			const result = cors.handlePreflight(ctx) as { headers: Headers };
			expect(result.headers.get(HeaderKey.AccessControlAllowOrigin)).toBe("*");
			expect(result.headers.get(HeaderKey.Vary)).toBeNull();
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

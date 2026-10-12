import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Cors } from "@/Cors";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Route } from "@/RouteBase/Route";

const PORT = 48185;
const BASE_URL = `http://localhost:${PORT}`;

const ORIGIN = "https://app.example.com";
const OTHER_ORIGIN = "https://evil.example.com";

let app: App;

const preflight = (origin: string) =>
	fetch(`${BASE_URL}/data`, {
		method: "OPTIONS",
		headers: {
			Origin: origin,
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers": "Content-Type",
		},
	});

beforeAll(async () => {
	initialize();

	Globals.set("apps", []);
	app = new App({ port: PORT, hostname: "localhost" });

	new Route("GET /data", (c) => {
		c.res.headers.setMany({ "X-Total-Count": "3" });
		return { ok: true };
	});
	new Route("POST /data", () => ({ created: true }));

	await app.listen();
});

afterAll(async () => {
	await app.close();
	Globals.delete("apps");
});

describe("Cors e2e", () => {
	describe("with an explicit allowlist", () => {
		beforeAll(() => {
			new Cors({
				allowedOrigins: [ORIGIN],
				allowedMethods: ["GET", "POST"],
				allowedHeaders: ["Content-Type", "Authorization"],
				exposedHeaders: ["X-Total-Count"],
				maxAge: 600,
			});
		});

		it("answers a preflight with 204 and the negotiated policy", async () => {
			const res = await preflight(ORIGIN);
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
			expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
			expect(res.headers.get("Access-Control-Max-Age")).toBe("600");
			expect(res.headers.get("Vary")).toContain("Origin");
			expect(await res.text()).toBe("");
		});

		it("applies the policy to an actual request without the preflight-only headers", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: ORIGIN } });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Expose-Headers")).toBe("X-Total-Count");
			expect(res.headers.get("X-Total-Count")).toBe("3");
			expect(res.headers.get("Access-Control-Max-Age")).toBeNull();
		});

		it("omits the allow-origin header for an origin outside the allowlist", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: OTHER_ORIGIN } });
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
		});

		it("varies on origin even for an origin outside the allowlist", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: OTHER_ORIGIN } });
			expect(res.headers.get("Vary")).toContain("Origin");
		});

		it("varies on origin when the request carries none", async () => {
			const res = await fetch(`${BASE_URL}/data`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
			expect(res.headers.get("Vary")).toContain("Origin");
		});

		it("omits allow-credentials when the policy does not set it", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: ORIGIN } });
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
		});

		it("still answers the preflight for a disallowed origin, without allowing it", async () => {
			const res = await preflight(OTHER_ORIGIN);
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
			expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
		});
	});

	describe("with a wildcard origin", () => {
		beforeAll(() => {
			new Cors({ allowedOrigins: ["*"], allowedMethods: ["GET", "POST"] });
		});

		it("allows any origin with a literal wildcard", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: OTHER_ORIGIN } });
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
		});

		it("does not vary on origin, since every origin gets the same response", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: OTHER_ORIGIN } });
			expect(res.headers.get("Vary")).toBeNull();
		});

		it("defaults to a 24 hour preflight cache when maxAge is not configured", async () => {
			const res = await preflight(ORIGIN);
			expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
		});
	});

	describe("with credentials and an explicit allowlist", () => {
		beforeAll(() => {
			new Cors({ allowedOrigins: [ORIGIN], credentials: true, allowedMethods: ["GET", "POST"] });
		});

		it("echoes the listed origin and varies on it", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: ORIGIN } });
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
			expect(res.headers.get("Vary")).toContain("Origin");
		});

		it("sends no allow-origin when the request carries no origin", async () => {
			const res = await fetch(`${BASE_URL}/data`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
			expect(res.headers.get("Vary")).toContain("Origin");
		});

		it("carries the credentialed policy through a preflight", async () => {
			const res = await preflight(ORIGIN);
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});
	});

	describe("with credentials and a wildcard origin", () => {
		beforeAll(() => {
			new Cors({ allowedOrigins: ["*"], credentials: true, allowedMethods: ["GET", "POST"] });
		});

		it("sends '*' rather than reflecting the caller, leaving the browser to reject it", async () => {
			// Reflecting here would hand any site a readable credentialed
			// response. The browser refuses the wildcard/credentials pair, which
			// is the outcome this configuration deserves.
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: OTHER_ORIGIN } });
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
			expect(res.headers.get("Vary")).toBeNull();
		});

		it("sends '*' on a preflight too", async () => {
			const res = await preflight(ORIGIN);
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		});
	});
});

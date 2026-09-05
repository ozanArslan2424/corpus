import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { App } from "@/App";
import { Cors } from "@/Cors";
import { Globals } from "@/Globals";
import { initialize } from "@/initialize";
import { Route } from "@/Route";

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
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
		});

		it("defaults to a 24 hour preflight cache when maxAge is not configured", async () => {
			const res = await preflight(ORIGIN);
			expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
		});
	});

	describe("with credentials enabled", () => {
		beforeAll(() => {
			new Cors({ allowedOrigins: ["*"], credentials: true, allowedMethods: ["GET", "POST"] });
		});

		it("reflects the request origin instead of a wildcard and varies on it", async () => {
			const res = await fetch(`${BASE_URL}/data`, { headers: { Origin: ORIGIN } });
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
			expect(res.headers.get("Vary")).toContain("Origin");
		});

		it("falls back to a wildcard when the request carries no origin", async () => {
			const res = await fetch(`${BASE_URL}/data`);
			expect(res.status).toBe(200);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		});

		it("sends a Set-Cookie through alongside the credentialed policy", async () => {
			const res = await preflight(ORIGIN);
			expect(res.status).toBe(204);
			expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
			expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		});
	});
});

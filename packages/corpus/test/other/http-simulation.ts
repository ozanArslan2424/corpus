import { type } from "arktype";

import { TestHelper } from "@/utils/TestHelper";

import { TC } from "../_modules";

// ── config ────────────────────────────────────────────────────────────────────

const PORT = 9876;
const BASE_URL = `http://localhost:${PORT}`;
const SILENT = process.argv[2] === "-s";
const T = new TestHelper(SILENT);
const server = new TC.Server({ port: PORT });

// ── http client ───────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ReqOptions {
	body?: any;
	headers?: Record<string, string>;
}

interface Res {
	status: number;
	headers: Headers;
	body: any;
	ok: boolean;
	elapsed: number;
}

async function req(method: HttpMethod, path: string, opts: ReqOptions = {}): Promise<Res> {
	const url = `${BASE_URL}${path}`;
	T.log.step(`${method} ${url}`);
	if (opts.body) T.log.debug("↑", T.stringify(opts.body));

	const start = performance.now();
	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json", ...opts.headers },
		body: opts.body !== undefined ? T.stringify(opts.body) : undefined,
	});
	const elapsed = performance.now() - start;
	const raw = await res.text();
	let body: any = raw;
	try {
		body = JSON.parse(raw);
	} catch {}

	T.log.info(`req took ${elapsed.toFixed(1)}ms`);
	T.log.debug(`↓ ${res.status}`, body);
	return {
		status: res.status,
		headers: res.headers,
		body,
		ok: res.ok,
		elapsed,
	};
}

const GET = (path: string, opts?: ReqOptions) => req("GET", path, opts);
const POST = (path: string, opts?: ReqOptions) => req("POST", path, opts);
const PUT = (path: string, opts?: ReqOptions) => req("PUT", path, opts);
const PATCH = (path: string, opts?: ReqOptions) => req("PATCH", path, opts);
const DELETE = (path: string, opts?: ReqOptions) => req("DELETE", path, opts);

// ── suite runner ──────────────────────────────────────────────────────────────

async function suite(name: string, fn: () => Promise<void>) {
	T.log.section(name);
	try {
		await fn();
	} catch (err) {
		const msg = `Suite "${name}" threw unT.expectedly: ${T.stringify(err)}`;
		T.log.error(msg);
		T.failures.push(msg);
		T.failed++;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────

// in-memory "db"
const db = new Map<number, { id: number; name: string; email: string; role: string }>();
let idCounter = 1;

const idParam = type({ id: "number" });
const wildParam = type({ "*": "string" });
const qSearch = type({ "q?": "string" });
const bodySchema = type({
	name: "string",
	email: "string.email",
	"role?": "string",
});

// ── global request logger middleware ─────────────────────────────────────────

new TC.Middleware({
	handler: (ctx) => {
		ctx.data = { requestedAt: Date.now() };
	},
});

// ── health ────────────────────────────────────────────────────────────────────

new TC.Route("/health", (c) => {
	c.res.status = 200;
	return { status: "ok", uptime: process.uptime() };
});

// ── users CRUD ────────────────────────────────────────────────────────────────

new TC.Route("/users", () => [...db.values()]);

new TC.Route(
	{ method: TC.Method.POST, path: "/users" },
	(c) => {
		const id = idCounter++;
		const user = {
			id,
			name: c.body.name,
			email: c.body.email,
			role: c.body.role ?? "user",
		};
		db.set(id, user);
		c.res.status = 201;
		return user;
	},
	{ body: bodySchema },
);

new TC.Route(
	"/users/:id",
	(ctx) => {
		const user = db.get(ctx.params.id);
		if (!user) {
			throw new TC.Exception("not found", 404);
		}
		return user;
	},
	{ params: idParam },
);

new TC.Route(
	{ method: TC.Method.PUT, path: "/users/:id" },
	(ctx) => {
		const user = db.get(ctx.params.id);
		if (!user) {
			throw new TC.Exception("not found", 404);
		}
		const body = ctx.body as any;
		const updated = { ...user, ...body, id: user.id };
		db.set(user.id, updated);
		return updated;
	},
	{ params: idParam },
);

new TC.Route(
	{ method: TC.Method.PATCH, path: "/users/:id" },
	(ctx) => {
		const user = db.get(ctx.params.id);
		if (!user) {
			throw new TC.Exception("not found", 404);
		}
		const body = ctx.body;
		const patched = { ...user, ...body, id: user.id };
		db.set(user.id, patched);
		return patched;
	},
	{ body: bodySchema.partial(), params: idParam },
);

new TC.Route(
	{ method: TC.Method.DELETE, path: "/users/:id" },
	(ctx) => {
		const existed = db.delete(ctx.params.id);
		if (!existed) {
			throw new TC.Exception("not found", 404);
		}
		return { deleted: ctx.params.id };
	},
	{ params: idParam },
);

// ── auth-protected routes ─────────────────────────────────────────────────────

const adminRoute = new TC.Route("/admin/dashboard", (ctx) => ({
	secret: "admin area",
	user: (ctx.data as any)?.user,
}));

const meRoute = new TC.Route("/me", (c) => {
	if ((c.data as any)?.user) {
		return (c.data as any).user;
	}
	throw new TC.Exception("unauthorized", 401);
});

new TC.Middleware({
	useOn: [adminRoute, meRoute],
	handler: (c) => {
		const token = c.headers.get("authorization");
		if (token !== "Bearer secret-token") {
			throw new TC.Exception("unauthorized", 401);
		}
		(c.data as any).user = { id: "0", name: "Admin", role: "admin" };
	},
});

// ── wildcard ──────────────────────────────────────────────────────────────────

new TC.Route(
	"/files/*",
	(ctx) => ({
		path: ctx.params["*"],
		served: true,
	}),
	{ params: wildParam },
);

// ── echo ──────────────────────────────────────────────────────────────────────

new TC.Route({ method: TC.Method.POST, path: "/echo" }, (ctx) => ({
	echoed: ctx.body,
	headers: {
		contentType: ctx.headers.get("content-type"),
		custom: ctx.headers.get("x-custom-header"),
	},
}));

// ── search with query params ──────────────────────────────────────────────────

new TC.Route(
	"/search",
	(ctx) => {
		const q = ctx.search.q;
		const values = [...db.values()];
		if (q === undefined) {
			return { q, results: values, total: values.length };
		} else {
			const results = values.filter(
				(u) =>
					u.name.toLowerCase().includes(q.toLowerCase()) ||
					u.email.toLowerCase().includes(q.toLowerCase()),
			);
			return { q, results, total: results.length };
		}
	},
	{ search: qSearch },
);

// ─────────────────────────────────────────────────────────────────────────────
//  START & RUN
// ─────────────────────────────────────────────────────────────────────────────

await server.listen();
T.log.info(`Server up on ${BASE_URL}\n`);

// ── HEALTH ────────────────────────────────────────────────────────────────────

await suite("HEALTH CHECK", async () => {
	const res = await GET("/health");
	T.expect("status", res.status).toMatchStatus(200);
	T.expect("body.status", res.body?.status).toBe("ok");
	T.expect("body has uptime", res.body).toHaveProperty("uptime");
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

await suite("CRUD - USERS", async () => {
	T.log.info("Creating alice...");
	const create = await POST("/users", {
		body: { name: "Alice", email: "alice@example.com" },
	});
	T.expect("create status", create.status).toMatchStatus(201);
	T.expect("create.name", create.body?.name).toBe("Alice");
	T.expect("create.email", create.body?.email).toBe("alice@example.com");
	T.expect("create has id", create.body).toHaveProperty("id");
	const aliceId = create.body.id;

	T.log.info("Creating bob...");
	const bob = await POST("/users", {
		body: { name: "Bob", email: "bob@example.com", role: "mod" },
	});
	T.expect("bob status", bob.status).toMatchStatus(201);
	T.expect("bob.role", bob.body?.role).toBe("mod");
	const bobId = bob.body.id;

	T.log.info("Listing all users...");
	const list = await GET("/users");
	T.expect("list status", list.status).toMatchStatus(200);
	T.expect("list is array", Array.isArray(list.body)).toBe(true);
	T.expect("list has 2 users", list.body?.length).toBe(2);

	T.log.info("Fetching alice by id...");
	const read = await GET(`/users/${aliceId}`);
	T.expect("read status", read.status).toMatchStatus(200);
	T.expect("read.name", read.body?.name).toBe("Alice");

	T.log.info("Full update alice...");
	const put = await PUT(`/users/${aliceId}`, {
		body: { name: "Alice Smith", email: "alice-smith@example.com" },
	});
	T.expect("put status", put.status).toMatchStatus(200);
	T.expect("put.name", put.body?.name).toBe("Alice Smith");
	T.expect("put.id unchanged", put.body?.id).toBe(aliceId);

	T.log.info("Partial update bob...");
	const patch = await PATCH(`/users/${bobId}`, { body: { role: "admin" } });
	T.expect("patch status", patch.status).toMatchStatus(200);
	T.expect("patch.role", patch.body?.role).toBe("admin");
	T.expect("patch.name unchanged", patch.body?.name).toBe("Bob");

	T.log.info("Deleting bob...");
	const del = await DELETE(`/users/${bobId}`);
	T.expect("delete status", del.status).toMatchStatus(200);
	T.expect("delete.deleted", del.body?.deleted).toBe(bobId);

	T.log.info("Confirming bob is gone...");
	const gone = await GET(`/users/${bobId}`);
	T.expect("gone status", gone.status).toMatchStatus(404);

	T.log.info("Confirming only alice remains...");
	const remaining = await GET("/users");
	T.expect("remaining count", remaining.body?.length).toBe(1);
});

// ── VALIDATION ────────────────────────────────────────────────────────────────

await suite("VALIDATION - BAD INPUT", async () => {
	T.log.info("POST /users with empty body...");
	const empty = await POST("/users", { body: {} });
	T.expect("empty body status", empty.status).toMatchStatus(422);
	T.expect("empty body has error field", empty.body).toHaveProperty("error");

	T.log.info("POST /users missing email...");
	const noEmail = await POST("/users", { body: { name: "Ghost" } });
	T.expect("no email status", noEmail.status).toMatchStatus(422);

	T.log.info("GET non-existent user...");
	const noUser = await GET("/users/99999");
	T.expect("no user status", noUser.status).toMatchStatus(404);

	T.log.info("PUT non-existent user...");
	const noPut = await PUT("/users/99999", { body: { name: "Nobody" } });
	T.expect("no put status", noPut.status).toMatchStatus(404);

	T.log.info("DELETE non-existent user...");
	const noDel = await DELETE("/users/99999");
	T.expect("no del status", noDel.status).toMatchStatus(404);
});

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────

await suite("AUTH - MIDDLEWARE PROTECTED ROUTES", async () => {
	T.log.info("GET /me without token...");
	const noToken = await GET("/me");
	T.expect("no token status", noToken.status).toMatchStatus(401);

	T.log.info("GET /admin/dashboard without token...");
	const noAdmin = await GET("/admin/dashboard");
	T.expect("no admin status", noAdmin.status).toMatchStatus(401);

	T.log.info("GET /me with valid token...");
	const withToken = await GET("/me", {
		headers: { Authorization: "Bearer secret-token" },
	});
	T.expect("with token status", withToken.status).toMatchStatus(200);
	T.expect("with token.name", withToken.body?.name).toBe("Admin");
	T.expect("with token.role", withToken.body?.role).toBe("admin");

	T.log.info("GET /admin/dashboard with valid token...");
	const admin = await GET("/admin/dashboard", {
		headers: { Authorization: "Bearer secret-token" },
	});
	T.expect("admin status", admin.status).toMatchStatus(200);
	T.expect("admin.secret", admin.body?.secret).toBe("admin area");

	T.log.info("GET /me with wrong token...");
	const wrong = await GET("/me", {
		headers: { Authorization: "Bearer wrong-token" },
	});
	T.expect("wrong token status", wrong.status).toMatchStatus(401);
});

// ── WILDCARD ──────────────────────────────────────────────────────────────────

await suite("WILDCARD ROUTES", async () => {
	T.log.info("GET /files/images/photo.png...");
	const r1 = await GET("/files/images/photo.png");
	T.expect("wildcard status", r1.status).toMatchStatus(200);
	T.expect("wildcard served", r1.body?.served).toBe(true);

	T.log.info("GET /files/docs/report/2024/q4.pdf (deep)...");
	const r2 = await GET("/files/docs/report/2024/q4.pdf");
	T.expect("deep wildcard status", r2.status).toMatchStatus(200);
	T.expect("deep wildcard served", r2.body?.served).toBe(true);
});

// ── ECHO ──────────────────────────────────────────────────────────────────────

await suite("ECHO - HEADERS & BODY PASSTHROUGH", async () => {
	T.log.info("POST /echo with nested body and custom header...");
	const res = await POST("/echo", {
		body: { hello: "corpus", nested: { works: true } },
		headers: { "X-Custom-Header": "blazing-fast" },
	});
	T.expect("echo status", res.status).toMatchStatus(200);
	T.expect("echo.hello", res.body?.echoed?.hello).toBe("corpus");
	T.expect("echo.nested.works", res.body?.echoed?.nested?.works).toBe(true);
	T.expect("echo custom header", res.body?.headers?.custom).toBe("blazing-fast");
	T.expect("echo content-type", res.body?.headers?.contentType).toContain("application/json");
});

// ── SEARCH ────────────────────────────────────────────────────────────────────

await suite("SEARCH - QUERY PARAMS", async () => {
	T.log.info("GET /search?q=alice...");
	const res = await GET("/search?q=alice");
	T.expect("search status", res.status).toMatchStatus(200);
	T.expect("search q", res.body?.q).toBe("alice");
	T.expect("search results array", Array.isArray(res.body?.results)).toBe(true);
	T.expect("search finds alice", res.body?.results?.[0]?.name).toBe("Alice Smith");

	T.log.info("GET /search?q=nobody...");
	const none = await GET("/search?q=nobody");
	T.expect("no results total", none.body?.total).toBe(0);

	T.log.info("GET /search (no q, returns all)...");
	const all = await GET("/search");
	T.expect("no query total", all.body?.total).toBeGreaterThan(0);
});

// ── CONCURRENT LOAD ───────────────────────────────────────────────────────────

await suite("PERFORMANCE - CONCURRENT REQUESTS", async () => {
	T.log.info("Firing 20 concurrent GETs at /health...");
	const results = await Promise.all(Array.from({ length: 20 }, () => GET("/health")));
	const allOk = results.every((r) => r.status === 200);
	T.expect("all 20 returned 200", allOk).toBe(true);
	const avg = results.reduce((s, r) => s + r.elapsed, 0) / results.length;
	T.log.info(`Average response time: ${avg.toFixed(2)}ms`);
	T.expect("avg < 100ms", avg).toBeLessThan(100);

	T.log.info("Firing 10 sequential POSTs to /users...");
	for (let i = 0; i < 10; i++) {
		const r = await POST("/users", {
			body: { name: `Bulk${i}`, email: `bulk${i}@test.com` },
		});
		T.expect(`bulk POST ${i}`, r.status).toMatchStatus(201);
	}

	T.log.info("Confirming all 10 + alice are in DB...");
	const all = await GET("/users");
	T.expect("total users in db", all.body?.length).toBe(11); // alice + 10 bulk
});

// ── UNKNOWN ROUTES ────────────────────────────────────────────────────────────

await suite("UNKNOWN ROUTES - 404s", async () => {
	for (const path of ["/nope", "/not/real", "/deeply/nested/unknown"]) {
		T.log.info(`GET ${path}...`);
		const res = await GET(path);
		T.expect(`${path} → 404`, res.status).toMatchStatus(404);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
//  TEARDOWN & SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

T.logResults("RESULTS FOR HTTP SIMULATION");

process.exit(T.failed > 0 ? 1 : 0);

import { type } from "arktype";

import { createTestServer, TEST_PORT } from "#testutils";
import { Middleware } from "@/C/Middleware/Middleware";
import { Route } from "@/C/Route/Route";

const server = createTestServer({ port: TEST_PORT });

// ── Parameterised routes (existing) ──────────────────────────────────────────

const r1 = new Route("/:param1/:param2", () => "ok");
const r2 = new Route("hello/:param1/:param2", () => "ok");
new Route("/world/:param1/:param2", () => "ok");
new Route("/lalala/:param1/:param2", () => "ok");
new Route("/yesyes/:param2", () => "ok");
new Route("/okay/:param1/letsgo", () => "ok");
new Route("/deneme/:param1/:param2", () => "ok");
new Route("/we/got/this", () => "ok");
new Route("/ohmyohmy", () => "ok");
new Route("/2bros", () => "ok");
new Route("/chillin/in/a/hottub", () => "ok");
new Route("/5/feet/apart/cuz/theyre/not/gay", () => "ok");
new Route("/verywild/*", () => "ok");
new Route("/craaaazy/*", () => "ok");

// ── Shared primitives ─────────────────────────────────────────────────────────

const Role = type("'admin' | 'editor' | 'viewer'");
const Status = type("'active' | 'inactive' | 'banned'");
const Pagination = type({
	page: type("string").pipe(Number),
	limit: type("string").pipe(Number),
});
const Timestamp = type({ createdAt: "string", updatedAt: "string" });

// ── User schemas ──────────────────────────────────────────────────────────────

const UserParams = type({ id: "string" });

const UserBody = type({
	name: "string",
	age: "number",
	role: Role,
	tags: "string[]",
	address: type({
		city: "string",
		country: "string",
		zip: "string | undefined",
	}),
});

const UserSearch = Pagination.and(type({ "role?": Role, "status?": Status }));

const UserResponse = type({
	id: "string",
	name: "string",
	age: "number",
	role: Role,
	status: Status,
	tags: "string[]",
}).and(Timestamp);

// ── Post schemas ──────────────────────────────────────────────────────────────

const PostBody = type({
	title: "string",
	content: "string",
	published: "boolean",
	metadata: type({
		views: "number",
		likes: "number",
		category: "'tech' | 'life' | 'other'",
	}),
});

const PostResponse = type({
	id: "string",
	title: "string",
	content: "string",
	published: "boolean",
	authorId: "string",
	metadata: type({
		views: "number",
		likes: "number",
		category: "'tech' | 'life' | 'other'",
	}),
}).and(Timestamp);

// ── Org schemas ───────────────────────────────────────────────────────────────

const OrgParams = type({ orgId: "string" });

const OrgBody = type({
	name: "string",
	plan: "'free' | 'pro' | 'enterprise'",
	seats: "number",
	owner: type({
		userId: "string",
		role: Role,
	}),
});

const OrgMemberParams = type({ orgId: "string", memberId: "string" });

const OrgMemberBody = type({
	role: Role,
	status: Status,
});

// ── Routes with models ────────────────────────────────────────────────────────

// POST /users — create user
new Route(
	{ method: "POST", path: "/users" },
	(c) => ({
		id: "1",
		...c.body,
		status: "active" as const,
		createdAt: "",
		updatedAt: "",
	}),
	{ body: UserBody, response: UserResponse },
);

// GET /users — list users with filters
new Route("/users", () => [], { search: UserSearch });

// GET /users/:id
new Route(
	"/users/:id",
	(c) => ({
		id: c.params.id,
		name: "ozan",
		age: 25,
		role: "admin" as const,
		status: "active" as const,
		tags: [],
		createdAt: "",
		updatedAt: "",
	}),
	{ params: UserParams, response: UserResponse },
);

// PUT /users/:id
new Route(
	{ method: "PUT", path: "/users/:id" },
	(c) => ({
		id: c.params.id,
		...c.body,
		status: "active" as const,
		createdAt: "",
		updatedAt: "",
	}),
	{ params: UserParams, body: UserBody, response: UserResponse },
);

// DELETE /users/:id
new Route({ method: "DELETE", path: "/users/:id" }, (c) => ({ deleted: c.params.id }), {
	params: UserParams,
});

// POST /users/:id/posts — create post for user
new Route(
	{ method: "POST", path: "/users/:id/posts" },
	(c) => ({
		id: "1",
		authorId: c.params.id,
		...c.body,
		createdAt: "",
		updatedAt: "",
	}),
	{ params: UserParams, body: PostBody, response: PostResponse },
);

// POST /orgs — create org
new Route(
	{ method: "POST", path: "/orgs" },
	(c) => ({ id: "1", ...c.body, createdAt: "", updatedAt: "" }),
	{ body: OrgBody },
);

// GET /orgs/:orgId/members
new Route("/orgs/:orgId/members", () => [], {
	params: OrgParams,
	search: Pagination,
});

// PUT /orgs/:orgId/members/:memberId — update member role/status
new Route(
	{ method: "PUT", path: "/orgs/:orgId/members/:memberId" },
	(c) => ({ orgId: c.params.orgId, memberId: c.params.memberId, ...c.body }),
	{ params: OrgMemberParams, body: OrgMemberBody },
);

// DELETE /orgs/:orgId/members/:memberId
new Route(
	{ method: "DELETE", path: "/orgs/:orgId/members/:memberId" },
	(c) => ({ removed: c.params.memberId }),
	{ params: OrgMemberParams },
);

// ── Middleware ────────────────────────────────────────────────────────────────

new Middleware({
	useOn: [r1, r2],
	handler: (c) => {
		c.data = {};
	},
});

void server.listen();

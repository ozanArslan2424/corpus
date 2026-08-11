import { type } from "arktype";

import { TC } from "../_modules";
import { createTestServer } from "../utils/createTestServer";
import { TEST_PORT } from "../utils/req";

const server = createTestServer({ port: TEST_PORT });

// ── Parameterised routes (existing) ──────────────────────────────────────────

const r1 = new TC.Route("/:param1/:param2", () => "ok");
const r2 = new TC.Route("hello/:param1/:param2", () => "ok");
new TC.Route("/world/:param1/:param2", () => "ok");
new TC.Route("/lalala/:param1/:param2", () => "ok");
new TC.Route("/yesyes/:param2", () => "ok");
new TC.Route("/okay/:param1/letsgo", () => "ok");
new TC.Route("/deneme/:param1/:param2", () => "ok");
new TC.Route("/we/got/this", () => "ok");
new TC.Route("/ohmyohmy", () => "ok");
new TC.Route("/2bros", () => "ok");
new TC.Route("/chillin/in/a/hottub", () => "ok");
new TC.Route("/5/feet/apart/cuz/theyre/not/gay", () => "ok");
new TC.Route("/verywild/*", () => "ok");
new TC.Route("/craaaazy/*", () => "ok");

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
new TC.Route(
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
new TC.Route("/users", () => [], { search: UserSearch });

// GET /users/:id
new TC.Route(
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
new TC.Route(
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
new TC.Route({ method: "DELETE", path: "/users/:id" }, (c) => ({ deleted: c.params.id }), {
	params: UserParams,
});

// POST /users/:id/posts — create post for user
new TC.Route(
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
new TC.Route(
	{ method: "POST", path: "/orgs" },
	(c) => ({ id: "1", ...c.body, createdAt: "", updatedAt: "" }),
	{ body: OrgBody },
);

// GET /orgs/:orgId/members
new TC.Route("/orgs/:orgId/members", () => [], {
	params: OrgParams,
	search: Pagination,
});

// PUT /orgs/:orgId/members/:memberId — update member role/status
new TC.Route(
	{ method: "PUT", path: "/orgs/:orgId/members/:memberId" },
	(c) => ({ orgId: c.params.orgId, memberId: c.params.memberId, ...c.body }),
	{ params: OrgMemberParams, body: OrgMemberBody },
);

// DELETE /orgs/:orgId/members/:memberId
new TC.Route(
	{ method: "DELETE", path: "/orgs/:orgId/members/:memberId" },
	(c) => ({ removed: c.params.memberId }),
	{ params: OrgMemberParams },
);

// ── Middleware ────────────────────────────────────────────────────────────────

new TC.Middleware({
	useOn: [r1, r2],
	handler: (c) => {
		c.data = {};
	},
});

void server.listen();

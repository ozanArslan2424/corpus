import { C } from "@ozanarslan/corpus";

import { getSchemas } from "./getSchemas";

const {
	Pagination,
	UserParams,
	UserBody,
	UserSearch,
	UserResponse,
	PostBody,
	PostResponse,
	OrgParams,
	OrgBody,
	OrgMemberParams,
	OrgMemberBody,
} = getSchemas("arktype");

export async function startServer(PORT: number = 9876) {
	const server = new C.Server();

	// ── Parameterised routes (existing) ──────────────────────────────────────────

	const r1 = new C.Route("/:param1/:param2", () => "ok");
	const r2 = new C.Route("hello/:param1/:param2", () => "ok");
	new C.Route("/world/:param1/:param2", () => "ok");
	new C.Route("/lalala/:param1/:param2", () => "ok");
	new C.Route("/yesyes/:param2", () => "ok");
	new C.Route("/okay/:param1/letsgo", () => "ok");
	new C.Route("/deneme/:param1/:param2", () => "ok");
	new C.Route("/we/got/this", () => "ok");
	new C.Route("/ohmyohmy", () => "ok");
	new C.Route("/2bros", () => "ok");
	new C.Route("/chillin/in/a/hottub", () => "ok");
	new C.Route("/5/feet/apart/cuz/theyre/not/gay", () => "ok");
	new C.Route("/verywild/*", () => "ok");
	new C.Route("/craaaazy/*", () => "ok");

	// ── Routes with models ────────────────────────────────────────────────────────

	// POST /users — create user
	new C.Route(
		{ method: "POST", path: "/users" },
		(c) => ({
			id: 1,
			...c.body,
			status: "active" as const,
			createdAt: "",
			updatedAt: "",
		}),
		{ body: UserBody, response: UserResponse },
	);

	// GET /users — list users with filters
	new C.Route("/users", (c) => [c.search.page], { search: UserSearch });

	// GET /users/:id
	new C.Route(
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
	new C.Route(
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
	new C.Route({ method: "DELETE", path: "/users/:id" }, (c) => ({ deleted: c.params.id }), {
		params: UserParams,
	});

	// POST /users/:id/posts — create post for user
	new C.Route(
		{ method: "POST", path: "/users/:id/posts" },
		(c) => ({
			id: 1,
			authorId: c.params.id,
			...c.body,
			createdAt: "",
			updatedAt: "",
		}),
		{ params: UserParams, body: PostBody, response: PostResponse },
	);

	// POST /orgs — create org
	new C.Route(
		{ method: "POST", path: "/orgs" },
		(c) => ({ id: "1", ...c.body, createdAt: "", updatedAt: "" }),
		{ body: OrgBody },
	);

	// GET /orgs/:orgId/members
	new C.Route("/orgs/:orgId/members", () => [], {
		params: OrgParams,
		search: Pagination,
	});

	// PUT /orgs/:orgId/members/:memberId — update member role/status
	new C.Route(
		{ method: "PUT", path: "/orgs/:orgId/members/:memberId" },
		(c) => ({ orgId: c.params.orgId, memberId: c.params.memberId, ...c.body }),
		{ params: OrgMemberParams, body: OrgMemberBody },
	);

	// DELETE /orgs/:orgId/members/:memberId
	new C.Route(
		{ method: "DELETE", path: "/orgs/:orgId/members/:memberId" },
		(c) => ({ removed: c.params.memberId }),
		{ params: OrgMemberParams },
	);

	// ── Middleware ────────────────────────────────────────────────────────────────

	new C.Middleware({
		useOn: [r1, r2],
		handler: (c) => {
			c.data = {};
		},
	});

	// ─────────────────────────────────────────────────────────────────────────────
	//  START & RUN
	// ─────────────────────────────────────────────────────────────────────────────

	await server.listen(PORT);
}

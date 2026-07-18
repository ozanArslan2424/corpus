import { TestHelper } from "@/utils/TestHelper";

import { CorpusApi } from "./apigen/generated";
import { startServer } from "./apigen/startServer";

const PORT = 9876;
const BASE_URL = `http://localhost:${PORT}`;
const SILENT = process.argv[2] === "-s";
const T = new TestHelper(SILENT);

await startServer(PORT);

T.log.info(`Server up on ${BASE_URL}\n`);

const api = new CorpusApi(BASE_URL);

// ── Parameterised routes ──────────────────────────────────────────────────────

{
	const res = await api.param1Param2Get({
		params: { param1: "foo", param2: "bar" },
	});
	T.expect("param1Param2Get returns ok", res).toBe("ok");
}

{
	const res = await api.helloParam1Param2Get({
		params: { param1: "foo", param2: "bar" },
	});
	T.expect("helloParam1Param2Get returns ok", res).toBe("ok");
}

{
	const res = await api.worldParam1Param2Get({
		params: { param1: "foo", param2: "bar" },
	});
	T.expect("worldParam1Param2Get returns ok", res).toBe("ok");
}

{
	const res = await api.lalalaParam1Param2Get({
		params: { param1: "a", param2: "b" },
	});
	T.expect("lalalaParam1Param2Get returns ok", res).toBe("ok");
}

{
	const res = await api.yesyesParam2Get({ params: { param2: "yes" } });
	T.expect("yesyesParam2Get returns ok", res).toBe("ok");
}

{
	const res = await api.okayParam1LetsgoGet({ params: { param1: "go" } });
	T.expect("okayParam1LetsgoGet returns ok", res).toBe("ok");
}

{
	const res = await api.denemeParam1Param2Get({
		params: { param1: "x", param2: "y" },
	});
	T.expect("denemeParam1Param2Get returns ok", res).toBe("ok");
}

{
	const res = await api.weGotThisGet({});
	T.expect("weGotThisGet returns ok", res).toBe("ok");
}

{
	const res = await api.ohmyohmyGet({});
	T.expect("ohmyohmyGet returns ok", res).toBe("ok");
}

{
	const res = await api._2brosGet({});
	T.expect("_2brosGet returns ok", res).toBe("ok");
}

{
	const res = await api.chillinInAHottubGet({});
	T.expect("chillinInAHottubGet returns ok", res).toBe("ok");
}

{
	const res = await api._5FeetApartCuzTheyreNotGayGet({});
	T.expect("_5FeetApartCuzTheyreNotGayGet returns ok", res).toBe("ok");
}

{
	const res = await api.verywild_Get({ params: { "*": "anything" } });
	T.expect("verywild_Get returns ok", res).toBe("ok");
}

{
	const res = await api.craaaazy_Get({ params: { "*": "wowzers" } });
	T.expect("craaaazy_Get returns ok", res).toBe("ok");
}

// ── User routes ───────────────────────────────────────────────────────────────

{
	const res = await api.usersPost({
		body: {
			name: "ozan",
			age: 25,
			role: "admin",
			tags: ["ts", "bun"],
			address: { city: "ankara", country: "turkey", zip: "06000" },
		},
	});
	T.expect("usersPost has id", res).toHaveProperty("id");
	T.expect("usersPost has name", res).toHaveProperty("name", "ozan");
	T.expect("usersPost has role", res).toHaveProperty("role", "admin");
	T.expect("usersPost has status", res).toHaveProperty("status");
}

{
	const res = await api.usersGet({ search: { page: 1, limit: 10 } });
	T.expect("usersGet returns array", Array.isArray(res)).toBe(true);
}

{
	const res = await api.usersGet({
		search: { page: 1, limit: 5, role: "editor" },
	});
	T.expect("usersGet with role filter returns array", Array.isArray(res)).toBe(true);
}

{
	const res = await api.usersIdGet({ params: { id: 1 } });
	T.expect("usersIdGet has id", res).toHaveProperty("id");
	T.expect("usersIdGet has role", res).toHaveProperty("role");
	T.expect("usersIdGet has status", res).toHaveProperty("status");
	T.expect("usersIdGet has tags", res).toHaveProperty("tags");
}

{
	const res = await api.usersIdPut({
		params: { id: 1 },
		body: {
			name: "ozan updated",
			age: 26,
			role: "editor",
			tags: ["ts"],
			address: { city: "istanbul", country: "turkey", zip: undefined },
		},
	});
	T.expect("usersIdPut has id", res).toHaveProperty("id", 1);
	T.expect("usersIdPut has updated name", res).toHaveProperty("name", "ozan updated");
	T.expect("usersIdPut has updated role", res).toHaveProperty("role", "editor");
}

{
	const res = await api.usersIdDelete({ params: { id: 1 } });
	T.expect("usersIdDelete has deleted", res).toHaveProperty("deleted", 1);
}

{
	const res = await api.usersIdPostsPost({
		params: { id: 42 },
		body: {
			title: "Hello World",
			content: "my first post",
			published: true,
			metadata: { category: "tech", likes: 0, views: 0 },
		},
	});
	T.expect("usersIdPostsPost has id", res).toHaveProperty("id");
	T.expect("usersIdPostsPost has authorId", res).toHaveProperty("authorId", 42);
	T.expect("usersIdPostsPost has title", res).toHaveProperty("title", "Hello World");
	T.expect("usersIdPostsPost has metadata", res).toHaveProperty("metadata");
}

{
	const res = await api.usersIdPostsPost({
		params: { id: 99 },
		body: {
			title: "Draft",
			content: "not published yet",
			published: false,
			metadata: { category: "life", likes: 5, views: 100 },
		},
	});
	T.expect("usersIdPostsPost unpublished has published=false", res).toHaveProperty(
		"published",
		false,
	);
	T.expect("usersIdPostsPost unpublished has category=life", (res as any)?.metadata?.category).toBe(
		"life",
	);
}

// ── Org routes ────────────────────────────────────────────────────────────────

{
	const res = await api.orgsPost({
		body: {
			name: "Acme Corp",
			plan: "pro",
			seats: 10,
			owner: { userId: 1, role: "admin" },
		},
	});
	T.expect("orgsPost has id", res).toHaveProperty("id");
	T.expect("orgsPost has name", res).toHaveProperty("name", "Acme Corp");
}

{
	const res = await api.orgsPost({
		body: {
			name: "Tiny Ltd",
			plan: "free",
			seats: 1,
			owner: { userId: 2, role: "viewer" },
		},
	});
	T.expect("orgsPost free plan has id", res).toHaveProperty("id");
}

{
	const res = await api.orgsOrgIdMembersGet({
		params: { orgId: 1 },
		search: { page: 1, limit: 20 },
	});
	T.expect("orgsOrgIdMembersGet returns array", Array.isArray(res)).toBe(true);
}

{
	const formData = new FormData();
	formData.set("role", "editor");
	formData.set("status", "active");

	const res = await api.orgsOrgIdMembersMemberIdPut<"formData">({
		params: { orgId: 1, memberId: 1 },
		body: formData,
	});
	T.expect("orgsOrgIdMembersMemberIdPut has orgId", res).toHaveProperty("orgId", 1);
	T.expect("orgsOrgIdMembersMemberIdPut has memberId", res).toHaveProperty("memberId", 1);
	T.expect("orgsOrgIdMembersMemberIdPut has role", res).toHaveProperty("role", "editor");
}

{
	const res = await api.orgsOrgIdMembersMemberIdPut({
		params: { orgId: 1, memberId: 2 },
		body: { role: "viewer", status: "inactive" },
	});
	T.expect("orgsOrgIdMembersMemberIdPut inactive has status", res).toHaveProperty(
		"status",
		"inactive",
	);
}

{
	const res = await api.orgsOrgIdMembersMemberIdDelete({
		params: { orgId: 1, memberId: 1 },
	});
	T.expect("orgsOrgIdMembersMemberIdDelete has removed", res).toHaveProperty("removed", 1);
}

// ─────────────────────────────────────────────────────────────────────────────

T.logResults("CLI GENERATED CLIENT TESTS");

process.exit(T.failed > 0 ? 1 : 0);

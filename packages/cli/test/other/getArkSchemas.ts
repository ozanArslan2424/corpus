import { type } from "arktype";

export function getArkSchemas() {
	const Role = type("'admin' | 'editor' | 'viewer'");
	const Status = type("'active' | 'inactive' | 'banned'");
	const Pagination = type({
		page: "number",
		limit: "number",
	});
	const Timestamp = type({ createdAt: "string", updatedAt: "string" });
	const UserParams = type({ id: "number" });
	const UserBody = type({
		name: "string",
		age: "number",
		role: Role,
		tags: "string[]",
		address: type({
			city: "string",
			country: "string",
			"zip?": "string",
		}),
	});
	const UserSearch = Pagination.and(type({ "role?": Role, "status?": Status }));

	const User = type({
		id: "number",
		name: "string",
		age: "number",
		role: Role,
		status: Status,
		tags: "string[]",
	}).and(Timestamp);

	const UserResponse = User;

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
		id: "number",
		title: "string",
		content: "string",
		published: "boolean",
		authorId: "number",
		metadata: type({
			views: "number",
			likes: "number",
			category: "'tech' | 'life' | 'other'",
		}),
	}).and(Timestamp);
	const OrgParams = type({ orgId: "number" });
	const OrgBody = type({
		name: "string",
		plan: "'free' | 'pro' | 'enterprise'",
		seats: "number",
		owner: type({
			userId: "number",
			role: Role,
		}),
	});
	const OrgMemberParams = type({ orgId: "number", memberId: "number" });
	const OrgMemberBody = type({
		role: Role,
		status: Status,
	});

	return {
		Role,
		Status,
		Pagination,
		Timestamp,
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
	};
}

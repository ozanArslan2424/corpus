import * as y from "yup";

export function getYupSchemas() {
	const Role = y.mixed<"admin" | "editor" | "viewer">().oneOf(["admin", "editor", "viewer"]);
	const Status = y
		.mixed<"active" | "inactive" | "banned">()
		.oneOf(["active", "inactive", "banned"]);
	const Pagination = y.object({
		page: y.number().required(),
		limit: y.number().required(),
	});
	const Timestamp = y.object({
		createdAt: y.string().required(),
		updatedAt: y.string().required(),
	});
	const UserParams = y.object({ id: y.number().required() });
	const UserBody = y.object({
		name: y.string().required(),
		age: y.number().required(),
		role: Role.required(),
		tags: y.array(y.string().required()).required(),
		address: y
			.object({
				city: y.string().required(),
				country: y.string().required(),
				zip: y.string().optional(),
			})
			.required(),
	});
	const UserSearch = Pagination.concat(
		y.object({ role: Role.optional(), status: Status.optional() }),
	);

	const User = y
		.object({
			id: y.number().required(),
			name: y.string().required(),
			age: y.number().required(),
			role: Role.required(),
			status: Status.required(),
			tags: y.array(y.string().required()).required(),
		})
		.concat(Timestamp);

	const UserResponse = User;

	const PostBody = y.object({
		title: y.string().required(),
		content: y.string().required(),
		published: y.boolean().required(),
		metadata: y
			.object({
				views: y.number().required(),
				likes: y.number().required(),
				category: y.mixed<"tech" | "life" | "other">().oneOf(["tech", "life", "other"]).required(),
			})
			.required(),
	});
	const PostResponse = y
		.object({
			id: y.number().required(),
			title: y.string().required(),
			content: y.string().required(),
			published: y.boolean().required(),
			authorId: y.number().required(),
			metadata: y
				.object({
					views: y.number().required(),
					likes: y.number().required(),
					category: y
						.mixed<"tech" | "life" | "other">()
						.oneOf(["tech", "life", "other"])
						.required(),
				})
				.required(),
		})
		.concat(Timestamp);
	const OrgParams = y.object({ orgId: y.number().required() });
	const OrgBody = y.object({
		name: y.string().required(),
		plan: y.mixed<"free" | "pro" | "enterprise">().oneOf(["free", "pro", "enterprise"]).required(),
		seats: y.number().required(),
		owner: y
			.object({
				userId: y.number().required(),
				role: Role.required(),
			})
			.required(),
	});
	const OrgMemberParams = y.object({
		orgId: y.number().required(),
		memberId: y.number().required(),
	});
	const OrgMemberBody = y.object({
		role: Role.required(),
		status: Status.required(),
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

import { z } from "zod";

export function getZodSchemas() {
	const Role = z.enum(["admin", "editor", "viewer"]);
	const Status = z.enum(["active", "inactive", "banned"]);
	const Pagination = z.object({
		page: z.number(),
		limit: z.number(),
	});
	const Timestamp = z.object({ createdAt: z.string(), updatedAt: z.string() });
	const UserParams = z.object({ id: z.number() });
	const UserBody = z.object({
		name: z.string(),
		age: z.number(),
		role: Role,
		tags: z.array(z.string()),
		address: z.object({
			city: z.string(),
			country: z.string(),
			zip: z.string().optional(),
		}),
	});
	const UserSearch = Pagination.and(z.object({ role: Role.optional(), status: Status.optional() }));

	const User = z
		.object({
			id: z.number(),
			name: z.string(),
			age: z.number(),
			role: Role,
			status: Status,
			tags: z.array(z.string()),
		})
		.and(Timestamp);

	const UserResponse = User;

	const PostBody = z.object({
		title: z.string(),
		content: z.string(),
		published: z.boolean(),
		metadata: z.object({
			views: z.number(),
			likes: z.number(),
			category: z.enum(["tech", "life", "other"]),
		}),
	});
	const PostResponse = z
		.object({
			id: z.number(),
			title: z.string(),
			content: z.string(),
			published: z.boolean(),
			authorId: z.number(),
			metadata: z.object({
				views: z.number(),
				likes: z.number(),
				category: z.enum(["tech", "life", "other"]),
			}),
		})
		.and(Timestamp);
	const OrgParams = z.object({ orgId: z.number() });
	const OrgBody = z.object({
		name: z.string(),
		plan: z.enum(["free", "pro", "enterprise"]),
		seats: z.number(),
		owner: z.object({
			userId: z.number(),
			role: Role,
		}),
	});
	const OrgMemberParams = z.object({ orgId: z.number(), memberId: z.number() });
	const OrgMemberBody = z.object({ role: Role, status: Status });
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

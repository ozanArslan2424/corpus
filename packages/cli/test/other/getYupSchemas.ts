import * as y from "yup";

// required-by-default aliases
const str = () => y.string().required();
const num = () => y.number().required();
const bool = () => y.boolean().required();
const obj = <T extends y.ObjectShape>(shape: T) => y.object(shape).required();
const arr = <T extends y.AnySchema>(inner: T) => y.array(inner).required();
const lit = <const T extends readonly string[]>(...values: T) =>
	y
		.mixed<T[number]>()
		.oneOf([...values])
		.required();

export function getYupSchemas() {
	const Role = lit("admin", "editor", "viewer");
	const Status = lit("active", "inactive", "banned");

	const Pagination = obj({ page: num(), limit: num() });
	const Timestamp = obj({ createdAt: str(), updatedAt: str() });

	const UserParams = obj({ id: num() });

	const UserBody = obj({
		name: str(),
		age: num(),
		role: Role,
		tags: arr(str()),
		address: obj({
			city: str(),
			country: str(),
			zip: y.string().optional(),
		}),
	});

	const UserSearch = Pagination.concat(
		y.object({ role: Role.optional(), status: Status.optional() }),
	);

	const User = obj({
		id: num(),
		name: str(),
		age: num(),
		role: Role,
		status: Status,
		tags: arr(str()),
	}).concat(Timestamp);

	const UserResponse = User;

	const Metadata = obj({
		views: num(),
		likes: num(),
		category: lit("tech", "life", "other"),
	});

	const PostBody = obj({
		title: str(),
		content: str(),
		published: bool(),
		metadata: Metadata,
	});

	const PostResponse = obj({
		id: num(),
		title: str(),
		content: str(),
		published: bool(),
		authorId: num(),
		metadata: Metadata,
	}).concat(Timestamp);

	const OrgParams = obj({ orgId: num() });

	const OrgBody = obj({
		name: str(),
		plan: lit("free", "pro", "enterprise"),
		seats: num(),
		owner: obj({ userId: num(), role: Role }),
	});

	const OrgMemberParams = obj({ orgId: num(), memberId: num() });

	const OrgMemberBody = obj({ role: Role, status: Status });

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

type _prim = string | number | boolean;

type _pretty<T> = { [K in keyof T]: T[K] } & {};

type _args<T> = Omit<T, "response"> & { headers?: HeadersInit; init?: RequestInit };

interface RequestDescriptor {
	endpoint: string;
	method: string;
	body?: unknown;
	search?: UnkObj;
	headers?: HeadersInit;
	init?: Omit<RequestInit, "headers">;
}

type UnkObj = Record<string, unknown>;

namespace Entities {
	const newable = <T,>() =>
		class {
			constructor(values: T) {
				Object.assign(this, values);
			}
		} as unknown as new (values: T) => T;

	export type User = {
		age: number;
		createdAt: string;
		id: number;
		name: string;
		role: "admin" | "editor" | "viewer";
		status: "active" | "banned" | "inactive";
		tags: string[];
		updatedAt: string;
	};
	export const User = newable<User>();
}

namespace Models {
	export type Param1Param2Get = _pretty<
		{ response: void } & { params: { param1: _prim; param2: _prim } } & { search?: UnkObj }
	>;
	export type HelloParam1Param2Get = _pretty<
		{ response: void } & { params: { param1: _prim; param2: _prim } } & { search?: UnkObj }
	>;
	export type WorldParam1Param2Get = _pretty<
		{ response: void } & { params: { param1: _prim; param2: _prim } } & { search?: UnkObj }
	>;
	export type LalalaParam1Param2Get = _pretty<
		{ response: void } & { params: { param1: _prim; param2: _prim } } & { search?: UnkObj }
	>;
	export type YesyesParam2Get = _pretty<
		{ response: void } & { params: { param2: _prim } } & { search?: UnkObj }
	>;
	export type OkayParam1LetsgoGet = _pretty<
		{ response: void } & { params: { param1: _prim } } & { search?: UnkObj }
	>;
	export type DenemeParam1Param2Get = _pretty<
		{ response: void } & { params: { param1: _prim; param2: _prim } } & { search?: UnkObj }
	>;
	export type WeGotThisGet = _pretty<{ response: void } & { search?: UnkObj }>;
	export type OhmyohmyGet = _pretty<{ response: void } & { search?: UnkObj }>;
	export type _2brosGet = _pretty<{ response: void } & { search?: UnkObj }>;
	export type ChillinInAHottubGet = _pretty<{ response: void } & { search?: UnkObj }>;
	export type _5FeetApartCuzTheyreNotGayGet = _pretty<{ response: void } & { search?: UnkObj }>;
	export type Verywild_Get = _pretty<
		{ response: void } & { params: { "*": _prim } } & { search?: UnkObj }
	>;
	export type Craaaazy_Get = _pretty<
		{ response: void } & { params: { "*": _prim } } & { search?: UnkObj }
	>;
	export type UsersPost<BT extends "json" | "formData" = "json"> = _pretty<
		{
			response: {
				age: number;
				createdAt: string;
				id: number;
				name: string;
				role: "admin" | "editor" | "viewer";
				status: "active" | "banned" | "inactive";
				tags: string[];
				updatedAt: string;
			};
		} & { search?: UnkObj } & {
			body: BT extends "formData"
				? FormData
				: {
						address: {
							city: string;
							country: string;
							zip?: string;
						};
						age: number;
						name: string;
						role: "admin" | "editor" | "viewer";
						tags: string[];
					};
		}
	>;
	export type UsersGet = _pretty<
		{ response: void } & {
			search?: {
				limit: number;
				page: number;
				role?: "admin" | "editor" | "viewer";
				status?: "active" | "banned" | "inactive";
			};
		}
	>;
	export type UsersIdGet = _pretty<
		{
			response: {
				age: number;
				createdAt: string;
				id: number;
				name: string;
				role: "admin" | "editor" | "viewer";
				status: "active" | "banned" | "inactive";
				tags: string[];
				updatedAt: string;
			};
		} & {
			params: {
				id: number;
			};
		} & { search?: UnkObj }
	>;
	export type UsersIdPut<BT extends "json" | "formData" = "json"> = _pretty<
		{
			response: {
				age: number;
				createdAt: string;
				id: number;
				name: string;
				role: "admin" | "editor" | "viewer";
				status: "active" | "banned" | "inactive";
				tags: string[];
				updatedAt: string;
			};
		} & {
			params: {
				id: number;
			};
		} & { search?: UnkObj } & {
			body: BT extends "formData"
				? FormData
				: {
						address: {
							city: string;
							country: string;
							zip?: string;
						};
						age: number;
						name: string;
						role: "admin" | "editor" | "viewer";
						tags: string[];
					};
		}
	>;
	export type UsersIdDelete = _pretty<
		{ response: void } & {
			params: {
				id: number;
			};
		} & { search?: UnkObj }
	>;
	export type UsersIdPostsPost<BT extends "json" | "formData" = "json"> = _pretty<
		{
			response: {
				authorId: number;
				content: string;
				createdAt: string;
				id: number;
				metadata: {
					category: "life" | "other" | "tech";
					likes: number;
					views: number;
				};
				published: boolean;
				title: string;
				updatedAt: string;
			};
		} & {
			params: {
				id: number;
			};
		} & { search?: UnkObj } & {
			body: BT extends "formData"
				? FormData
				: {
						content: string;
						metadata: {
							category: "life" | "other" | "tech";
							likes: number;
							views: number;
						};
						published: boolean;
						title: string;
					};
		}
	>;
	export type OrgsPost<BT extends "json" | "formData" = "json"> = _pretty<
		{ response: void } & { search?: UnkObj } & {
			body: BT extends "formData"
				? FormData
				: {
						name: string;
						owner: {
							role: "admin" | "editor" | "viewer";
							userId: number;
						};
						plan: "enterprise" | "free" | "pro";
						seats: number;
					};
		}
	>;
	export type OrgsOrgIdMembersGet = _pretty<
		{ response: void } & {
			params: {
				orgId: number;
			};
		} & {
			search?: {
				limit: number;
				page: number;
			};
		}
	>;
	export type OrgsOrgIdMembersMemberIdPut<BT extends "json" | "formData" = "json"> = _pretty<
		{ response: void } & {
			params: {
				memberId: number;
				orgId: number;
			};
		} & { search?: UnkObj } & {
			body: BT extends "formData"
				? FormData
				: {
						role: "admin" | "editor" | "viewer";
						status: "active" | "banned" | "inactive";
					};
		}
	>;
	export type OrgsOrgIdMembersMemberIdDelete = _pretty<
		{ response: void } & {
			params: {
				memberId: number;
				orgId: number;
			};
		} & { search?: UnkObj }
	>;
}

namespace Args {
	export type Param1Param2Get = _args<Models.Param1Param2Get>;
	export type HelloParam1Param2Get = _args<Models.HelloParam1Param2Get>;
	export type WorldParam1Param2Get = _args<Models.WorldParam1Param2Get>;
	export type LalalaParam1Param2Get = _args<Models.LalalaParam1Param2Get>;
	export type YesyesParam2Get = _args<Models.YesyesParam2Get>;
	export type OkayParam1LetsgoGet = _args<Models.OkayParam1LetsgoGet>;
	export type DenemeParam1Param2Get = _args<Models.DenemeParam1Param2Get>;
	export type WeGotThisGet = _args<Models.WeGotThisGet>;
	export type OhmyohmyGet = _args<Models.OhmyohmyGet>;
	export type _2brosGet = _args<Models._2brosGet>;
	export type ChillinInAHottubGet = _args<Models.ChillinInAHottubGet>;
	export type _5FeetApartCuzTheyreNotGayGet = _args<Models._5FeetApartCuzTheyreNotGayGet>;
	export type Verywild_Get = _args<Models.Verywild_Get>;
	export type Craaaazy_Get = _args<Models.Craaaazy_Get>;
	export type UsersPost<BT extends "json" | "formData" = "json"> = _args<Models.UsersPost<BT>>;
	export type UsersGet = _args<Models.UsersGet>;
	export type UsersIdGet = _args<Models.UsersIdGet>;
	export type UsersIdPut<BT extends "json" | "formData" = "json"> = _args<Models.UsersIdPut<BT>>;
	export type UsersIdDelete = _args<Models.UsersIdDelete>;
	export type UsersIdPostsPost<BT extends "json" | "formData" = "json"> = _args<
		Models.UsersIdPostsPost<BT>
	>;
	export type OrgsPost<BT extends "json" | "formData" = "json"> = _args<Models.OrgsPost<BT>>;
	export type OrgsOrgIdMembersGet = _args<Models.OrgsOrgIdMembersGet>;
	export type OrgsOrgIdMembersMemberIdPut<BT extends "json" | "formData" = "json"> = _args<
		Models.OrgsOrgIdMembersMemberIdPut<BT>
	>;
	export type OrgsOrgIdMembersMemberIdDelete = _args<Models.OrgsOrgIdMembersMemberIdDelete>;
}

class CorpusApi {
	constructor(public readonly baseUrl: string) {}

	public fetchFn: <R = unknown>(args: RequestDescriptor) => Promise<R> = async (args) => {
		const url = new URL(args.endpoint, this.baseUrl);
		const headers = new Headers(args.headers);
		const method: RequestInit["method"] = args.method;
		let body: RequestInit["body"];
		if (args.search) {
			for (const [key, val] of Object.entries(args.search)) {
				if (val == null) {
					continue;
				}
				url.searchParams.append(
					key,
					typeof val === "object" ? JSON.stringify(val) : String(val as _prim),
				);
			}
		}
		if (args.body) {
			if (!headers.has("content-type") && !(args.body instanceof FormData)) {
				headers.set("content-type", "application/json");
			}
			body = args.body instanceof FormData ? args.body : JSON.stringify(args.body);
		}
		const req = new Request(url, { method, headers, body, ...args.init });
		const res = await fetch(req);
		const contentType = res.headers.get("content-type");
		const isJson = contentType?.includes("application/json");
		const isText = contentType?.includes("text/");
		let data: any;
		let err: string;
		if (isJson) {
			data = await res.json();
			err = data.message ?? res.statusText;
		} else if (isText) {
			data = await res.text();
			err = data !== "" ? data : res.statusText;
		} else {
			data = await res.blob();
			err = res.statusText;
		}
		if (!res.ok) throw new Error(err, { cause: data });
		return data;
	};

	public setFetchFn(cb: <R = unknown>(args: RequestDescriptor) => Promise<R>) {
		return (this.fetchFn = cb);
	}

	public readonly endpoints = {
		param1Param2Get: (p: Args.Param1Param2Get["params"]) =>
			`/${String(p.param1)}/${String(p.param2)}`,
		helloParam1Param2Get: (p: Args.HelloParam1Param2Get["params"]) =>
			`/hello/${String(p.param1)}/${String(p.param2)}`,
		worldParam1Param2Get: (p: Args.WorldParam1Param2Get["params"]) =>
			`/world/${String(p.param1)}/${String(p.param2)}`,
		lalalaParam1Param2Get: (p: Args.LalalaParam1Param2Get["params"]) =>
			`/lalala/${String(p.param1)}/${String(p.param2)}`,
		yesyesParam2Get: (p: Args.YesyesParam2Get["params"]) => `/yesyes/${String(p.param2)}`,
		okayParam1LetsgoGet: (p: Args.OkayParam1LetsgoGet["params"]) =>
			`/okay/${String(p.param1)}/letsgo`,
		denemeParam1Param2Get: (p: Args.DenemeParam1Param2Get["params"]) =>
			`/deneme/${String(p.param1)}/${String(p.param2)}`,
		weGotThisGet: "/we/got/this",
		ohmyohmyGet: "/ohmyohmy",
		_2brosGet: "/2bros",
		chillinInAHottubGet: "/chillin/in/a/hottub",
		_5FeetApartCuzTheyreNotGayGet: "/5/feet/apart/cuz/theyre/not/gay",
		verywild_Get: (p: Args.Verywild_Get["params"]) => `/verywild/${String(p["*"])}`,
		craaaazy_Get: (p: Args.Craaaazy_Get["params"]) => `/craaaazy/${String(p["*"])}`,
		usersPost: "/users",
		usersGet: "/users",
		usersIdGet: (p: Args.UsersIdGet["params"]) => `/users/${String(p.id)}`,
		usersIdPut: (p: Args.UsersIdPut["params"]) => `/users/${String(p.id)}`,
		usersIdDelete: (p: Args.UsersIdDelete["params"]) => `/users/${String(p.id)}`,
		usersIdPostsPost: (p: Args.UsersIdPostsPost["params"]) => `/users/${String(p.id)}/posts`,
		orgsPost: "/orgs",
		orgsOrgIdMembersGet: (p: Args.OrgsOrgIdMembersGet["params"]) =>
			`/orgs/${String(p.orgId)}/members`,
		orgsOrgIdMembersMemberIdPut: (p: Args.OrgsOrgIdMembersMemberIdPut["params"]) =>
			`/orgs/${String(p.orgId)}/members/${String(p.memberId)}`,
		orgsOrgIdMembersMemberIdDelete: (p: Args.OrgsOrgIdMembersMemberIdDelete["params"]) =>
			`/orgs/${String(p.orgId)}/members/${String(p.memberId)}`,
	};

	public param1Param2Get(args: Args.Param1Param2Get) {
		const req = {
			endpoint: `/${String(args.params.param1)}/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.Param1Param2Get["response"]>(req);
	}

	public helloParam1Param2Get(args: Args.HelloParam1Param2Get) {
		const req = {
			endpoint: `/hello/${String(args.params.param1)}/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.HelloParam1Param2Get["response"]>(req);
	}

	public worldParam1Param2Get(args: Args.WorldParam1Param2Get) {
		const req = {
			endpoint: `/world/${String(args.params.param1)}/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.WorldParam1Param2Get["response"]>(req);
	}

	public lalalaParam1Param2Get(args: Args.LalalaParam1Param2Get) {
		const req = {
			endpoint: `/lalala/${String(args.params.param1)}/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.LalalaParam1Param2Get["response"]>(req);
	}

	public yesyesParam2Get(args: Args.YesyesParam2Get) {
		const req = {
			endpoint: `/yesyes/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.YesyesParam2Get["response"]>(req);
	}

	public okayParam1LetsgoGet(args: Args.OkayParam1LetsgoGet) {
		const req = {
			endpoint: `/okay/${String(args.params.param1)}/letsgo`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.OkayParam1LetsgoGet["response"]>(req);
	}

	public denemeParam1Param2Get(args: Args.DenemeParam1Param2Get) {
		const req = {
			endpoint: `/deneme/${String(args.params.param1)}/${String(args.params.param2)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.DenemeParam1Param2Get["response"]>(req);
	}

	public weGotThisGet(args: Args.WeGotThisGet) {
		const req = {
			endpoint: "/we/got/this",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.WeGotThisGet["response"]>(req);
	}

	public ohmyohmyGet(args: Args.OhmyohmyGet) {
		const req = {
			endpoint: "/ohmyohmy",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.OhmyohmyGet["response"]>(req);
	}

	public _2brosGet(args: Args._2brosGet) {
		const req = {
			endpoint: "/2bros",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models._2brosGet["response"]>(req);
	}

	public chillinInAHottubGet(args: Args.ChillinInAHottubGet) {
		const req = {
			endpoint: "/chillin/in/a/hottub",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.ChillinInAHottubGet["response"]>(req);
	}

	public _5FeetApartCuzTheyreNotGayGet(args: Args._5FeetApartCuzTheyreNotGayGet) {
		const req = {
			endpoint: "/5/feet/apart/cuz/theyre/not/gay",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models._5FeetApartCuzTheyreNotGayGet["response"]>(req);
	}

	public verywild_Get(args: Args.Verywild_Get) {
		const req = {
			endpoint: `/verywild/${String(args.params["*"])}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.Verywild_Get["response"]>(req);
	}

	public craaaazy_Get(args: Args.Craaaazy_Get) {
		const req = {
			endpoint: `/craaaazy/${String(args.params["*"])}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.Craaaazy_Get["response"]>(req);
	}

	public usersPost<BT extends "json" | "formData" = "json">(args: Args.UsersPost<BT>) {
		const req = {
			endpoint: "/users",
			method: "POST",
			search: args.search,
			body: args.body,
		};
		return this.fetchFn<Models.UsersPost["response"]>(req);
	}

	public usersGet(args: Args.UsersGet) {
		const req = {
			endpoint: "/users",
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.UsersGet["response"]>(req);
	}

	public usersIdGet(args: Args.UsersIdGet) {
		const req = {
			endpoint: `/users/${String(args.params.id)}`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.UsersIdGet["response"]>(req);
	}

	public usersIdPut<BT extends "json" | "formData" = "json">(args: Args.UsersIdPut<BT>) {
		const req = {
			endpoint: `/users/${String(args.params.id)}`,
			method: "PUT",
			search: args.search,
			body: args.body,
		};
		return this.fetchFn<Models.UsersIdPut["response"]>(req);
	}

	public usersIdDelete(args: Args.UsersIdDelete) {
		const req = {
			endpoint: `/users/${String(args.params.id)}`,
			method: "DELETE",
			search: args.search,
		};
		return this.fetchFn<Models.UsersIdDelete["response"]>(req);
	}

	public usersIdPostsPost<BT extends "json" | "formData" = "json">(
		args: Args.UsersIdPostsPost<BT>,
	) {
		const req = {
			endpoint: `/users/${String(args.params.id)}/posts`,
			method: "POST",
			search: args.search,
			body: args.body,
		};
		return this.fetchFn<Models.UsersIdPostsPost["response"]>(req);
	}

	public orgsPost<BT extends "json" | "formData" = "json">(args: Args.OrgsPost<BT>) {
		const req = {
			endpoint: "/orgs",
			method: "POST",
			search: args.search,
			body: args.body,
		};
		return this.fetchFn<Models.OrgsPost["response"]>(req);
	}

	public orgsOrgIdMembersGet(args: Args.OrgsOrgIdMembersGet) {
		const req = {
			endpoint: `/orgs/${String(args.params.orgId)}/members`,
			method: "GET",
			search: args.search,
		};
		return this.fetchFn<Models.OrgsOrgIdMembersGet["response"]>(req);
	}

	public orgsOrgIdMembersMemberIdPut<BT extends "json" | "formData" = "json">(
		args: Args.OrgsOrgIdMembersMemberIdPut<BT>,
	) {
		const req = {
			endpoint: `/orgs/${String(args.params.orgId)}/members/${String(args.params.memberId)}`,
			method: "PUT",
			search: args.search,
			body: args.body,
		};
		return this.fetchFn<Models.OrgsOrgIdMembersMemberIdPut["response"]>(req);
	}

	public orgsOrgIdMembersMemberIdDelete(args: Args.OrgsOrgIdMembersMemberIdDelete) {
		const req = {
			endpoint: `/orgs/${String(args.params.orgId)}/members/${String(args.params.memberId)}`,
			method: "DELETE",
			search: args.search,
		};
		return this.fetchFn<Models.OrgsOrgIdMembersMemberIdDelete["response"]>(req);
	}
}

export type { RequestDescriptor, Models, Args };

export { Entities, CorpusApi };

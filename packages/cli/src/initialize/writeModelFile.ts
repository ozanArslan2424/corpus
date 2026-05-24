import type { Config } from "../config";
import type { ModuleInterface } from "../Module/ModuleInterface";
import { TypescriptWriter } from "../TypescriptWriter/TypescriptWriter";

export function writeModelFile(c: Config, m: ModuleInterface): string {
	const w = new TypescriptWriter(m.model.filePath);

	if (!c.validationLibrary) {
		w.$comment({ variant: "line", text: "No validation library detected." });
		w.$interface({
			variant: "interface",
			isExported: true,
			name: m.modelTypeName,
			body: (w) => {
				w.line(
					`entity: { id: string, name: string }`,
					`get: { params: { id: string }, response: ${m.modelTypeName}["entity"] }`,
					`list: { search: { page?: string, limit?: string }, response: [${m.modelTypeName}["entity"]] }`,
					`create: { body: { name: string }, response: ${m.modelTypeName}["entity"] }`,
					`update: { params: ${m.modelTypeName}["get"]["params"], body: { name: string }, response: ${m.modelTypeName}["entity"] }`,
					`delete: { params: ${m.modelTypeName}["get"]["params"], response: undefined }`,
				);
			},
		});

		return w.read();
	}

	w.$import({ keys: ["X"], from: c.pkgPath });

	let schemas = {
		entity: ``,
		get: ``,
		list: ``,
		create: ``,
		update: ``,
		delete: ``,
	};

	switch (c.validationLibrary) {
		case "arktype":
			w.$import({ keys: ["type"], from: "arktype" });
			schemas = {
				entity: `type({ id: "string", name: "string" })`,
				get: `{ params: type({ id: "string" }), response: this.entity }`,
				list: `{ search: type({ "page?": type("string").pipe(Number), "limit?": type("string").pipe(Number), }), response: this.entity.array() }`,
				create: `{ body: type({ name: "string > 3" }), response: this.entity }`,
				update: `{ params: this.get.params, body: this.create.body.partial(), response: this.entity }`,
				delete: `{ params: this.get.params, response: type("undefined") }`,
			};
			break;

		case "zod":
			w.$import({ def: "* as z", from: "zod" });
			schemas = {
				entity: `z.object({ id: z.string(), name: z.string() })`,
				get: `{ params: z.object({ id: z.string() }), response: this.entity }`,
				list: `{ search: z.object({ page: z.string().transform(Number).optional(), limit: z.string().transform(Number).optional() }), response: this.entity.array() }`,
				create: `{ body: z.object({ name: z.string().min(3) }), response: this.entity }`,
				update: `{ params: this.get.params, body: this.create.body.partial(), response: this.entity }`,
				delete: `{ params: this.get.params, response: z.undefined() }`,
			};
			break;

		case "yup":
			w.$import({ def: "* as yup", from: "yup" });
			schemas = {
				entity: `yup.object({ id: yup.string().required(), name: yup.string().required() })`,
				get: `{ params: yup.object({ id: yup.string().required() }), response: this.entity }`,
				list: `{ search: yup.object({ page: yup.number(), limit: yup.number() }), response: yup.array().of(this.entity) }`,
				create: `{ body: yup.object({ name: yup.string().min(3).required() }), response: this.entity }`,
				update: `{ params: this.get.params, body: yup.object({ name: yup.string() }), response: this.entity }`,
				delete: `{ params: this.get.params, response: yup.object() }`,
			};
			break;

		// case "valibot":
		// 	w.$import({ def: "* as v", from: "valibot" });
		// 	schemas = {
		// 		entity: `v.object({ id: v.string(), name: v.string() })`,
		// 		get: `{ params: v.object({ id: v.string() }), response: this.entity }`,
		// 		list: `{ search: v.object({ page: v.optional(v.pipe(v.string(), v.transform(Number))), limit: v.optional(v.pipe(v.string(), v.transform(Number))), }), response: v.array(this.entity) }`,
		// 		create: `{ body: v.object({ name: v.string() }), response: this.entity }`,
		// 		update: `{ params: this.get.params, body: v.partial(this.create.body), response: this.entity, }`,
		// 		delete: `{ params: this.get.params, response: v.undefined() }`,
		// 	};
		// 	break;

		default:
			break;
	}

	w.$type({
		isExported: true,
		name: m.modelTypeName,
		value: `X.InferModel<typeof ${m.model.name}>`,
	});
	w.$class({
		isExported: true,
		name: m.model.name,
		body: (w) => {
			for (const [name, value] of Object.entries(schemas)) {
				w.$member({ keyword: "static", name, value });
			}
		},
	});

	return w.read();
}

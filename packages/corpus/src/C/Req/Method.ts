import { enumerate, type ValueOf, type OrString } from "@/utils";

export const Method = enumerate({
	GET: "GET",
	POST: "POST",
	PUT: "PUT",
	PATCH: "PATCH",
	DELETE: "DELETE",
	HEAD: "HEAD",
	OPTIONS: "OPTIONS",
	CONNECT: "CONNECT",
	TRACE: "TRACE",
});

export type Method = OrString<ValueOf<typeof Method>>;

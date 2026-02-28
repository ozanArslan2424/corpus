import type { ValueOf } from "@/utils/types/ValueOf";

/** Commonly used HTTP verbs. */

export const Method = {
	/* Retrieve a resource from the server */
	GET: "GET",
	/* Submit data to create a new resource */
	POST: "POST",
	/* Replace an entire resource with new data */
	PUT: "PUT",
	/* Apply partial modifications to a resource */
	PATCH: "PATCH",
	/* Remove a resource from the server */
	DELETE: "DELETE",
	/* Get response headers without body */
	HEAD: "HEAD",
	/* Discover communication options */
	OPTIONS: "OPTIONS",
	/* Establish tunnel to server */
	CONNECT: "CONNECT",
	/* Echo back received request */
	TRACE: "TRACE",
} as const;

export type Method = ValueOf<typeof Method>;

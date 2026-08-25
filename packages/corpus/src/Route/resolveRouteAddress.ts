import { arrIncludes, assert, objGetValues } from "@ozanarslan/utils";

import { Method } from "@/enums/Method";
import type { RouteAddress } from "@/Route/types";

export function resolveRouteAddress<E extends string>(
	address: RouteAddress<E>,
): { path: E; method: Method } {
	if (typeof address !== "string") return address;
	if (!address.includes(" ")) return { method: Method.GET, path: address as E };

	const [method, endpoint] = address.split(" ");
	assert(
		arrIncludes(method?.toUpperCase(), Array.from(objGetValues(Method))),
		`Route address cannot include whitespaces unless it starts with an HTTP verb. Received: ${address}`,
	);
	assert(
		typeof endpoint === "string" && endpoint.trim() !== "",
		`Route address cannot include whitespaces unless it starts with an HTTP verb and ends with a path. Received: ${address}`,
	);
	return { method: method.toUpperCase() as Method, path: endpoint as E };
}

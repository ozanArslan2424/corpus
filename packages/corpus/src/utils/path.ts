import type { Optional } from "@/utils/maybe";

export type WithLeadingSlash<E extends string> = E extends `/${string}` ? E : `/${E}`;

export type WithPrefix<Px extends Optional<string>, E extends string> = Px extends string
	? `${WithLeadingSlash<Px>}${WithLeadingSlash<E>}`
	: WithLeadingSlash<E>;

export function joinPathSegments<P extends string>(
	...segments: Array<string | undefined | number>
): P {
	const joined = segments
		.map((segment) => (typeof segment === "number" ? `${segment}` : segment))
		.filter((segment): segment is string => !!segment)
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter((segment) => segment.length > 0)
		.join("/");

	return `/${joined}` as P;
}

export function withLeadingSlash<E extends string>(rawEndpoint: E): WithLeadingSlash<E> {
	return (rawEndpoint.startsWith("/") ? rawEndpoint : `/${rawEndpoint}`) as WithLeadingSlash<E>;
}

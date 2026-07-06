export function joinPathSegments<E extends string>(
	...segments: (string | undefined | number)[]
): E {
	const joined = segments
		.map((segment) => (typeof segment === "number" ? segment.toString() : segment))
		.filter((segment): segment is string => segment != null && segment.trim() !== "")
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter((segment) => segment.length > 0)
		.join("/");

	return `/${joined}` as E;
}

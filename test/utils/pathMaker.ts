export function pathMaker(prefix: string) {
	return (path: string) => `${prefix}${path}`;
}

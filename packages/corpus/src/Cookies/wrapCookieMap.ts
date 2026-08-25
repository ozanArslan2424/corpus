import type { Func } from "@ozanarslan/utils/function";

export function wrapCookieMap(
	map: Bun.CookieMap,
	syncCallback: Func<[Bun.CookieMap]>,
): Bun.CookieMap {
	return new Proxy(map, {
		get: (target, prop, receiver) => {
			const value = Reflect.get(target, prop, receiver);
			if (prop === "set" || prop === "delete") {
				return (...args: unknown[]) => {
					const result = value.apply(target, args);
					syncCallback(target);
					return result;
				};
			}
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

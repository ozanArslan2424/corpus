import type { Cookies } from "@/C/Cookies/Cookies";
import type { Func } from "@/utils";

export function wrapCookieMap(map: Cookies, syncCallback: Func<[Cookies]>): Cookies {
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

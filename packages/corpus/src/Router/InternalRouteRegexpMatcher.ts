import type { Method } from "@/enums/Method";
import type { Middleware } from "@/Middleware/Middleware";
import type { MiddlewareUseOn } from "@/Middleware/types";
import type { RouterInterface } from "@/Registry/types";
import type { BaseRoute } from "@/Route/BaseRoute";
import type { RouterReturn } from "@/Router/types";

type Entry = {
	regexp: RegExp;
	paramNames: string[];
	method: Method;
	route: BaseRoute;
};

export class InternalRouteRegexpMatcher implements RouterInterface {
	private readonly entries: Array<Entry> = [];
	private readonly middlewares: Map<string, Array<Middleware>> = new Map();

	find(method: Method, url: string | URL): RouterReturn | null {
		const pathname = url instanceof URL ? url.pathname : this.getPathname(url);

		for (const entry of this.entries) {
			if (entry.method !== method) continue;

			const match = entry.regexp.exec(pathname);
			if (!match) continue;

			const params: Record<string, string> = {};
			for (const [i, paramName] of entry.paramNames.entries()) {
				params[paramName] = decodeURIComponent(match[i + 1] ?? "");
			}

			const route = entry.route;
			const middlewares = this.findMiddlewares(route.id);

			return { route, params, middlewares };
		}

		return null;
	}

	add(data: BaseRoute): void {
		const { regexp, paramNames } = this.compile(data.endpoint);
		this.entries.push({ regexp, paramNames, method: data.method, route: data });
	}

	list(): Array<BaseRoute> {
		return this.entries.map((entry) => entry.route);
	}

	public addMiddleware(middleware: Middleware): void {
		for (const routeId of this.resolveMiddlewareRouteIds(middleware.useOn)) {
			const arr = this.middlewares.get(routeId);
			if (arr) arr.push(middleware);
			else this.middlewares.set(routeId, [middleware]);
		}
	}

	public findMiddlewares(routeId: string): Array<Middleware> {
		const global = routeId === "*" ? [] : (this.middlewares.get("*") ?? []);
		const local = this.middlewares.get(routeId) ?? [];
		return [...global, ...local];
	}

	private compile(endpoint: string): { regexp: RegExp; paramNames: string[] } {
		let path = endpoint;
		if (path === "" || path.charCodeAt(0) !== 47) path = "/" + path;

		const paramNames: string[] = [];
		let source = "";

		const endsWithWildcard = path.endsWith("*");
		if (endsWithWildcard) path = path.slice(0, -1);

		for (const segment of path.split("/")) {
			if (segment === "") continue;
			source += "/";
			if (segment.charCodeAt(0) === 58) {
				// :param
				paramNames.push(segment.slice(1));
				source += "([^/]+)";
			} else {
				source += this.escape(segment);
			}
		}

		if (source === "") source = "/";

		if (endsWithWildcard) {
			paramNames.push("*");
			source += "(.*)";
		}

		return { regexp: new RegExp(`^${source}/?$`), paramNames };
	}

	private escape(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	private getPathname(url: string): string {
		const schemeEnd = url.indexOf("://");
		const start = url.indexOf("/", schemeEnd === -1 ? 0 : schemeEnd + 3);
		if (start === -1) return "/";
		let end = url.length;
		const q = url.indexOf("?", start);
		if (q !== -1) end = q;
		const h = url.indexOf("#", start);
		if (h !== -1 && h < end) end = h;
		const pathname = url.slice(start, end);
		return pathname === "" ? "/" : pathname;
	}

	private resolveMiddlewareRouteIds(useOn: MiddlewareUseOn): string[] {
		if (useOn === "*") return ["*"];
		const targets = Array.isArray(useOn) ? useOn : [useOn];
		const routeIds = new Set<string>();
		for (const target of targets) {
			if (typeof target === "string") {
				routeIds.add(target);
			} else if ("id" in target) {
				routeIds.add(target.id);
			} else {
				target.routeIds.forEach((id) => routeIds.add(id));
			}
		}
		return Array.from(routeIds);
	}
}

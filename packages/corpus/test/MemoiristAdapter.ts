import Memoirist from "memoirist";

import type { RouterInterface, BaseRoute, RouterReturn, C } from "#corpus";

/**
 * Router adapter wrapping the "memoirist" package.
 *
 * @see {@link https://github.com/SaltyAom/memoirist memoirist}
 * @author {@link https://github.com/SaltyAom SaltyAom}
 *
 * No code was copied; this is purely a thin adapter layer over the package's public API.
 *
 * MemoiristAdapter benchmark results: (600 routes)
 * Setup Time: 5.80
 * Lookups:    60,000
 * Hit rate:   100.00%
 * Accuracy:   100.00%
 * Avg:        0.0001ms
 * Min:        0.0000ms
 * Max:        0.3639ms
 * P95:        0.0000ms
 * P99:        0.0005ms
 * RPS:        19849324
 */
export class MemoiristAdapter implements RouterInterface {
	addMiddleware(_middleware: C.Middleware): void {}
	findMiddlewares(_routeId: string): Array<C.Middleware> {
		return [];
	}
	readonly __brand: string = "MemoiristAdapter";
	private readonly router = new Memoirist<BaseRoute>();

	find(method: C.Method, url: string | URL): RouterReturn | null {
		const pathname = this.getPathname(url);
		const result = this.router.find(method, pathname);
		if (!result) return null;
		const route = result.store;
		const params = result.params;
		return { route, params, middlewares: [] };
	}

	list(): Array<BaseRoute> {
		return Object.values(this.router.root)
			.map((node) => node.store)
			.filter((store) => store !== null);
	}

	add(data: BaseRoute): void {
		this.router.add(data.method, data.endpoint, data);
	}

	private getPathname(url: string | URL) {
		if (url instanceof URL) {
			return url.pathname;
		}

		// Skip scheme + host: find the first "/" after "://"
		const schemeEnd = url.indexOf("://");
		const start = url.indexOf("/", schemeEnd === -1 ? 0 : schemeEnd + 3);
		let pathname: string;
		if (start === -1) {
			pathname = "/";
		} else {
			let end = url.length;
			const q = url.indexOf("?", start);
			if (q !== -1) end = q;
			const h = url.indexOf("#", start);
			if (h !== -1 && h < end) end = h;
			pathname = url.slice(start, end);
			if (pathname === "") pathname = "/";
		}
		return pathname;
	}
}

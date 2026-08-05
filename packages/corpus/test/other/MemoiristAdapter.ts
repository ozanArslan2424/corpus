import Memoirist from "memoirist";

import type { RouterInterface, RouterData, RouterReturn, TC } from "../_modules";

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
	readonly __brand: string = "MemoiristAdapter";
	private readonly router = new Memoirist<RouterData>();

	find(method: TC.Method, pathname: string): RouterReturn | null {
		const result = this.router.find(method, pathname);
		if (!result) return null;
		const route = result.store;
		const params = result.params;
		return { route, params };
	}

	list(): Array<RouterData> {
		return Object.values(this.router.root)
			.map((node) => node.store)
			.filter((store) => store !== null);
	}

	add(data: RouterData): void {
		this.router.add(data.method, data.endpoint, data);
	}
}

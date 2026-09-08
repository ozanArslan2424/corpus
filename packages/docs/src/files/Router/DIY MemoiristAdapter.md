# Memoirist Router Example

This example uses the Memoirist router from [Elysia](https://github.com/elysiajs/elysia).

```ts
import Memoirist from "memoirist";

import type { RouterAdapterInterface, RouterData, RouterReturn, TC } from "../_modules";

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
export class MemoiristAdapter implements RouterAdapterInterface {
	readonly __brand: string = "MemoiristAdapter";
	private readonly router = new Memoirist<RouterData>();

	find(req: TC.Req): RouterReturn | null {
		const method = req.method;
		const pathname = req.urlObject.pathname;

		const result = this.router.find(method, pathname);
		if (!result) return null;
		const route = result.store;
		const params = result.params;
		return { route, params };
	}

	list: (() => Array<RouterData>) | undefined = () => {
		return this.router.history.map((v) => v[2]);
	};

	add(data: RouterData): void {
		this.router.add(data.method, data.endpoint, data);
	}
}
```

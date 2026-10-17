import { AsyncLocalStorage } from "node:async_hooks";

import type { Renderable } from "@/definitions/Renderable";

/** The set the render in progress collects into. One per request, so concurrent renders never mix. */
const storage = new AsyncLocalStorage<Set<Renderable>>();

/** Runs a render that collects its renderables into `into`, in first-use order. */
export function collectAssets<T>(into: Set<Renderable>, fn: () => Promise<T>): Promise<T> {
	return storage.run(into, fn);
}

/** Registers a renderable with the render in progress. Repeats are ignored. */
export function useAssets(renderable: Renderable): void {
	storage.getStore()?.add(renderable);
}

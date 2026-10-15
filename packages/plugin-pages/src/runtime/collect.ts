import { AsyncLocalStorage } from "node:async_hooks";

import type { Renderable } from "@/definitions/Renderable";
import { tagsOf } from "@/runtime/registry";
import { html, type Html } from "@/shared/html";

/** Renderables used by the render in progress, in first-use order. One set per render, safe across concurrent requests. */
const storage = new AsyncLocalStorage<Set<Renderable>>();

/** Runs a render with its own asset collection. */
export function collectAssets<T>(fn: () => Promise<T>): Promise<T> {
	return storage.run(new Set(), fn);
}

/** Registers a renderable's assets with the render in progress. Repeats are ignored. */
export function useAssets(renderable: Renderable): void {
	storage.getStore()?.add(renderable);
}

/** `<link>` elements for every stylesheet used so far in the render in progress. */
export function renderStyles(): Html {
	return html`${[...(storage.getStore() ?? [])].map((renderable) => tagsOf(renderable).style)}`;
}

/** `<script>` elements for every script used so far. `data-script` lets the client run each one only once. */
export function renderScripts(): Html {
	return html`${[...(storage.getStore() ?? [])].map((renderable) => tagsOf(renderable).script)}`;
}

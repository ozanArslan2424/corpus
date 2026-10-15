import path from "node:path";

import { registerAssets } from "@/runtime/registry";
import type { Css } from "@/shared/css";

/**
 * Runs in the browser, once per document. Write it inline in a page, layout or component definition.
 * It can use its module's top-level constants, functions and imports; those are copied into a shared module.
 */
export type ClientScript = () => void;

/** The file that called `component(...)` / `layout(...)` / `page(...)`: the first stack frame outside this directory. */
export function callerFile(): string | undefined {
	for (const frame of (new Error().stack ?? "").split("\n").slice(1)) {
		const match = /((?:[A-Za-z]:)?[^\s():]+):\d+:\d+\)?\s*$/.exec(frame);
		if (match && path.dirname(match[1]!) !== import.meta.dir) return match[1];
	}
	return undefined;
}

export type RenderableKind = "page" | "layout" | "component";

/** What pages, layouts and components share: an identity and the assets they carry. */
export interface Renderable {
	readonly kind: RenderableKind;
	/** Unique per kind. Becomes the asset file name, e.g. component `ThemeToggle` → `/styles/component-themetoggle.css`. */
	readonly id: string;
	/** Written to `public/styles`, linked whenever this renderable is part of a render. */
	readonly style?: Css;
	/** Bundled to `public/scripts` by Bun. Runs in the browser once per document. */
	readonly script?: ClientScript;
	/** The file it was defined in; its script is compiled as part of that module. */
	readonly source?: string;
}

/** Turns `fn` into a renderable of `kind` and registers its assets. Shared by `page`, `layout` and `component`. */
export function defineRenderable<T extends Renderable>(
	kind: T["kind"],
	id: string,
	assets: { style?: Css; script?: ClientScript },
	fn: Function,
	extra: Omit<T, keyof Renderable | keyof Function> = {} as Omit<
		T,
		keyof Renderable | keyof Function
	>,
): T {
	const source = assets.script ? callerFile() : undefined;
	const self = Object.assign(
		fn,
		{ kind, id, style: assets.style, script: assets.script, source },
		extra,
	) as unknown as T;
	registerAssets(self);
	return self;
}

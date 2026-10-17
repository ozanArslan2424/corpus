import { addRenderable } from "@/runtime/registry";
import type { Css } from "@/shared/css";

export type RenderableKind = "page" | "layout" | "component";

export interface RenderableBase {
	readonly kind: RenderableKind;
	/** Unique per kind. Becomes the asset file name, e.g. component `ThemeToggle` → `/styles/component-themetoggle.css`. */
	readonly id: string;
	/** The file it was defined in. */
	readonly src: string;
	/** The file name for transpiled assets. */
	readonly ref: string;
}

export interface RenderableDefinition {
	/** Written to `public/styles`, linked whenever this renderable is part of a render. */
	readonly style?: Css;
	/** Bundled to `public/scripts` by Bun. Runs in the browser once per document. */
	readonly script?: Function;
}

export interface Renderable extends RenderableBase, RenderableDefinition {}

interface CallSite {
	getFileName(): string | undefined;
}

function getSrc(): string | undefined {
	const prepare = Error.prepareStackTrace;
	const limit = Error.stackTraceLimit;
	let stack: Array<CallSite> | undefined;
	try {
		Error.stackTraceLimit = 50;
		Error.prepareStackTrace = (_error, callSites) => callSites;
		const holder: { stack?: unknown } = {};
		Error.captureStackTrace(holder, getSrc);
		stack = holder.stack as unknown as Array<CallSite> | undefined;
	} finally {
		Error.prepareStackTrace = prepare;
		Error.stackTraceLimit = limit;
	}

	if (!stack) return undefined;

	for (const callSite of stack) {
		const file = callSite.getFileName();
		if (!file) continue;
		if (file.startsWith("node:") || file.startsWith("bun:")) continue;
		const path = file.startsWith("file://") ? Bun.fileURLToPath(file) : file;
		if (path.includes("/node_modules/")) continue;
		return path;
	}

	return undefined;
}

function getRef(kind: string, id: string): string {
	return `${kind}-${id}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function defineRenderable<R extends Renderable>(
	kind: R["kind"],
	id: string,
	definition: RenderableDefinition,
	fn: Function,
): R {
	const src = getSrc();
	const ref = getRef(kind, id);
	const self = Object.assign(fn, definition, { kind, id, src, ref }) as unknown as R;
	addRenderable(self);
	return self;
}

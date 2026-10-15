import type { Renderable } from "@/definitions/Renderable";
import type { Html } from "@/shared/html";
import { assert } from "@/utils/assert";

export interface AssetTags {
	style?: Html;
	script?: Html;
}

export const renderables = new Set<Renderable>();
export const tags = new WeakMap<Renderable, AssetTags>();

/** Called when a renderable is defined so `writeAssets` knows about it. */
export function registerAssets(renderable: Renderable): void {
	if (renderable.style || renderable.script) renderables.add(renderable);
}

export function tagsOf(renderable: Renderable): AssetTags {
	if (!renderable.style && !renderable.script) return {};
	const result = tags.get(renderable);
	if (!result)
		throw new Error(
			`Assets for ${renderable.kind} "${renderable.id}" weren't written; call writeAssets() before listening`,
		);
	return result;
}

/** The `<script>` tag for the client router; set by `writeAssets`. */
let routerTag: Html | undefined;

export function setRouterTag(tag: Html): void {
	routerTag = tag;
}

export function getRouterTag(): Html {
	assert.present(
		routerTag,
		"The router script wasn't written; call writeAssets() before listening",
	);
	return routerTag;
}

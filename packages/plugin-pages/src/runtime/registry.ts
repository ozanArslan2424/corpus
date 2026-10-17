import type { Renderable } from "@/definitions/Renderable";
import type { Nullable } from "@/utils/is";

const map = new Map<Renderable["ref"], Renderable>();

export function getRenderable(ref: Renderable["ref"]): Nullable<Renderable> {
	return map.get(ref) ?? null;
}

export function getRenderableMap() {
	return map;
}

export function addRenderable(renderable: Renderable) {
	map.set(renderable.ref, renderable);
}

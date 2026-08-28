import type { ContentDispositionDefinition } from "@/C/Headers/Headers.types";

export function createContentDispositionHeader(def: ContentDispositionDefinition) {
	if (def.filename === undefined) return def.disposition;
	return `${def.disposition}; filename="${def.filename}"`;
}

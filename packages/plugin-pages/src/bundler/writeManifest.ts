import fs from "node:fs/promises";
import path from "path";

import type { RenderableBase } from "@/definitions/Renderable";
import { getRenderableMap } from "@/runtime/registry";
import { isPresent } from "@/utils/is";

interface RenderableEntry extends RenderableBase {}
interface StyleEntry {
	ref: RenderableBase["ref"];
}
interface ScriptEntry {
	ref: RenderableBase["ref"];
}

export interface Manifest {
	renderables: Array<RenderableEntry>;
	styles: Array<StyleEntry>;
	scripts: Array<ScriptEntry>;
}

export async function writeManifest(assetsDir: string): Promise<Manifest> {
	const manifest: Manifest = {
		renderables: [],
		styles: [],
		scripts: [],
	};

	for (const [ref, r] of getRenderableMap()) {
		manifest.renderables.push({
			kind: r.kind,
			id: r.id,
			src: r.src,
			ref,
		});
		if (isPresent(r.style)) {
			manifest.styles.push({ ref });
		}
		if (isPresent(r.script)) {
			manifest.scripts.push({ ref });
		}
	}

	await fs.writeFile(
		path.join(assetsDir, "manifest.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);

	return manifest;
}

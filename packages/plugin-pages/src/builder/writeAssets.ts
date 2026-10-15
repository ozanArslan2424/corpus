import fs from "node:fs/promises";
import path from "node:path";

import { bundleRouter } from "@/builder/bundleRouter";
import { bundleScripts, type ScriptSource } from "@/builder/bundleScripts";
import { bundleStyles } from "@/builder/bundleStyles";
import type { Renderable } from "@/definitions/Renderable";
import { renderables, setRouterTag, tags } from "@/runtime/registry";
import { html } from "@/shared/html";

function fileName(renderable: Renderable): string {
	return `${renderable.kind}-${renderable.id}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function version(source: string): string {
	return Bun.hash(source).toString(36);
}

/**
 * Writes every registered stylesheet to `<assets>/styles` and bundles every script to `<assets>/scripts`.
 * Run it after all pages, layouts and components are defined.
 */
export async function writeAssets(assetsDir: string, servePath = "/"): Promise<void> {
	const stylesDir = path.join(assetsDir, "styles");
	const scriptsDir = path.join(assetsDir, "scripts");
	await fs.rm(stylesDir, { recursive: true, force: true });
	await fs.rm(scriptsDir, { recursive: true, force: true });
	await fs.mkdir(stylesDir, { recursive: true });
	await fs.mkdir(scriptsDir, { recursive: true });

	const seen = new Map<string, Renderable>();
	for (const renderable of renderables) {
		const name = fileName(renderable);
		if (seen.has(name)) throw new Error(`Two assets resolve to the same file name "${name}"`);
		seen.set(name, renderable);
	}

	const styles: Array<{ name: string; css: string }> = [];
	const sources: Array<ScriptSource> = [];

	for (const [name, renderable] of seen) {
		if (renderable.style) styles.push({ name, css: renderable.style.value });
		if (renderable.script) {
			if (!renderable.source) {
				throw new Error(`Couldn't find where ${renderable.kind} "${renderable.id}" was defined`);
			}
			sources.push({ name, file: renderable.source, script: renderable.script });
		}
		tags.set(renderable, {});
	}

	const [styleOutputs, scriptOutputs, router] = await Promise.all([
		bundleStyles(styles, stylesDir),
		bundleScripts(sources, scriptsDir),
		bundleRouter(scriptsDir),
	]);
	setRouterTag(
		html`<script type="module" src="${servePath}scripts/router.js?v=${version(router)}"></script>`,
	);

	for (const [name, renderable] of seen) {
		const result = tags.get(renderable)!;
		const style = styleOutputs.get(name);
		if (style !== undefined) {
			result.style = html`<link
				rel="stylesheet"
				href="${servePath}styles/${name}.css?v=${version(style)}"
			/>`;
		}
		const script = scriptOutputs.get(name);
		if (script !== undefined) {
			result.script = html`<script
				type="module"
				src="${servePath}scripts/${name}.js?v=${version(script)}"
				data-script="${name}"
			></script>`;
		}
	}
}

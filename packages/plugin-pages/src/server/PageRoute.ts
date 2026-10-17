import {
	Context,
	Exception,
	HeaderKey,
	Method,
	resolveRouteAddress,
	RouteBase,
	RouteVariant,
	Status,
	type ContextHandler,
	type RouteAddress,
	type RouteConfig,
} from "@ozanarslan/corpus";

import { htmlDocument, type HtmlDocument } from "@/definitions/HtmlDocument";
import type { Layout } from "@/definitions/Layout";
import type { Page } from "@/definitions/Page";
import type { Renderable } from "@/definitions/Renderable";
import { collectAssets, useAssets } from "@/runtime/assets";
import {
	loadedState,
	loaderState,
	runRenderScope,
	setRenderMode,
	type AnyLoader,
	type LoaderData,
	type LoaderDeps,
	type RenderMode,
} from "@/runtime/loaders";
import { ASSETS_SERVE_PATH, LOADING_MARKER } from "@/shared/constants";
import { html, Html } from "@/shared/html";

export interface PageRenderState {
	layouts: Array<Layout<any, any, any, any>>;
	title: string;
	from: number;
	/** Renderables this render used, outermost first. The page's tags are built from these. */
	assets: Set<Renderable>;
}

declare module "@ozanarslan/corpus" {
	interface ContextDataInterface {
		renderState?: PageRenderState;
	}
}

export type AnyPageRoute = PageRoute<any, any, any, any, any>;

export type PageRouteRes = string | ReadableStream<Uint8Array>;

function assetUrl(...segments: Array<string>): string {
	return ASSETS_SERVE_PATH.replace("*", segments.join("/"));
}

/** `<link>` elements for the stylesheets this render used, in first-use order. */
function renderStyles(assets: Set<Renderable>): Html {
	const tags: Array<Html> = [];
	for (const renderable of assets) {
		if (renderable.style === undefined) continue;
		tags.push(
			html`<link rel="stylesheet" href="${assetUrl("styles", `${renderable.ref}.css`)}" />`,
		);
	}
	return html`${tags}`;
}

/** `<script>` elements for the scripts this render used. `data-script` lets the client run each once. */
function renderScripts(assets: Set<Renderable>): Html {
	const tags: Array<Html> = [];
	for (const renderable of assets) {
		if (renderable.script === undefined) continue;
		tags.push(
			html`<script
				type="module"
				src="${assetUrl("scripts", `${renderable.ref}.js`)}"
				data-script="${renderable.ref}"
			></script>`,
		);
	}
	return html`${tags}`;
}

export class PageRoute<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> extends RouteBase<B, S, P, PageRouteRes, E> {
	constructor(
		address: RouteAddress<E>,
		readonly page: Page<L, B, S, P, E>,
		readonly deps: LoaderDeps<L>,
	) {
		super();
		const { method, endpoint } = resolveRouteAddress(address);
		this.method = method;
		this.endpoint = endpoint;
		this.register();
	}

	override method: Method;
	override endpoint: E;
	override variant: RouteVariant = RouteVariant.bundle;
	override config?: RouteConfig<B, S, P, PageRouteRes> | undefined;
	/** Outermost first. Filled in by the layouts this route is passed to. */
	readonly layouts: Array<Layout<any, any, any, any>> = [];
	/** Set by the document this route is passed to; full renders without one use `htmlDocument()`'s defaults. */
	document: HtmlDocument | undefined = undefined;

	override handler: ContextHandler<B, S, P, PageRouteRes> = async (c) => {
		const layouts = this.layouts;
		// Layouts the client already has mounted, outermost first.
		const mounted = (c.req.headers.get("X-Layouts") ?? "").split(",").filter(Boolean);
		const state: PageRenderState = {
			layouts,
			title: this.page.title ?? "",
			from: this.sharedDepth(layouts, mounted),
			assets: new Set(),
		};
		c.data.renderState = state;

		c.res.headers.setCacheControl({ public: true, maxAge: 3600, noCache: false });
		c.res.headers.setMany({
			[HeaderKey.ContentType]: "text/html; charset=utf-8",
			[HeaderKey.Vary]: "X-Layouts, Accept-Language, Cookie",
		});

		return collectAssets(state.assets, () =>
			runRenderScope(c, async () => {
				if (state.from === 0) {
					const body = await this.renderTree(c, state, "settled");
					c.res.status = this.status();
					return body.value;
				}

				// Partial: client swaps this into the deepest layout it already has.
				const parent = state.layouts.at(state.from - 1);
				c.res.headers.setMany({
					"X-Slot": parent?.id ?? "",
					"X-Title": encodeURIComponent(state.title),
				});

				if (!this.hasLoaders(state)) {
					const body = await this.renderTree(c, state, "settled");
					c.res.status = this.status();
					return body.value;
				}

				// Streamed: the status is already 200 by the time the loaders settle.
				c.res.headers.set("X-Loading", "1");

				const pending = await this.renderTree(c, state, "pending");
				const encoder = new TextEncoder();
				return new ReadableStream<Uint8Array>({
					start: async (controller) => {
						controller.enqueue(encoder.encode(pending.value + LOADING_MARKER));
						try {
							const settled = await this.renderTree(c, state, "settled");
							controller.enqueue(encoder.encode(settled.value));
							controller.close();
						} catch (err) {
							// Headers are already sent; erroring the stream makes the client fall back to a full load.
							controller.error(err);
						}
					},
				});
			}),
		);
	};

	hasLoaders(state: PageRenderState): boolean {
		if (this.page.loader) return true;
		return state.layouts.slice(state.from).some((layout) => layout.loader !== undefined);
	}

	status(): number {
		const state = loadedState(this.page);
		if (state?.status !== "error") return Status.OK;
		return state.error instanceof Exception ? state.error.status : Status.INTERNAL_SERVER_ERROR;
	}

	async renderTree(
		c: Context<B, S, P, PageRouteRes>,
		state: PageRenderState,
		mode: RenderMode,
	): Promise<Html> {
		setRenderMode(mode);
		// Outermost first, so inner styles win the cascade.
		const active = state.layouts.slice(state.from);
		for (const layout of active) useAssets(layout);
		useAssets(this.page);

		const definition = this.page;
		const loader = definition.loader as AnyLoader | undefined;
		const pageState = await loaderState<LoaderData<L>>(
			this.page,
			loader && (() => loader.apply(c, this.deps as Array<unknown>)),
		);
		let content = await definition.render(Object.assign(c, { state: pageState }));

		for (const layout of active.slice().reverse()) {
			const layoutLoader = layout.loader;
			const layoutState = await loaderState(layout, layoutLoader && (() => layoutLoader.call(c)));

			content = await layout.render(
				Object.assign(c, {
					state: layoutState,
					title: state.title,
					children: html`<div data-slot="${layout.id}">${content}</div>`,
				}),
			);
		}

		// Everything has rendered by now, so every component has registered its renderable.
		const styles = renderStyles(state.assets);
		const scripts = renderScripts(state.assets);

		if (state.from === 0) {
			return (this.document ?? htmlDocument()).render({
				title: state.title,
				styles,
				scripts: html`<script type="module" src="${assetUrl("router.js")}"></script>
					${scripts}`,
				body: content,
			});
		}

		return html`${styles}${content}${scripts}`;
	}

	/** How many of the page's layouts the client already has mounted, matched outermost first. */
	sharedDepth(layouts: Array<Layout<any, any, any, any>>, mounted: Array<string>): number {
		let shared = 0;
		while (shared < layouts.length && mounted[shared] === layouts[shared]?.id) shared++;
		return shared;
	}
}

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
import { defineRenderable, type ClientScript, type Renderable } from "@/definitions/Renderable";
import { collectAssets, renderScripts, renderStyles, useAssets } from "@/runtime/collect";
import {
	loadedState,
	loaderState,
	runRenderScope,
	setRenderMode,
	type AnyLoader,
	type LoaderData,
	type LoaderDeps,
	type LoaderState,
	type RenderMode,
} from "@/runtime/loaders";
import { getRouterTag } from "@/runtime/registry";
import type { Css } from "@/shared/css";
import { html, Html } from "@/shared/html";
import { LOADING_MARKER } from "@/shared/markers";

export interface PageRenderState {
	layouts: Array<Layout<any, any, any, any>>;
	title: string;
	from: number;
}

declare module "@ozanarslan/corpus" {
	interface ContextDataInterface {
		renderState?: PageRenderState;
	}
}

export type PageRouteRes = string | ReadableStream<Uint8Array>;

// export type PageContext<B = unknown, S = unknown, P = unknown> = C.Context<B, S, P, PageRouteRes>;

export type PageRenderProps<
	Data = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> = LoaderState<Data> & {
	c: Context<B, S, P, PageRouteRes>;
};

export type PageRender<Data = undefined, B = unknown, S = unknown, P = unknown> = (
	props: PageRenderProps<Data, B, S, P>,
) => Bun.MaybePromise<Html>;

export interface PageDefinition<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> {
	title: string | ((c: Context<B, S, P, PageRouteRes>) => string);
	style?: Css;
	script?: ClientScript;
	loader?: L;
	render: PageRender<LoaderData<L>, B, S, P>;
}

export type Page<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
> = Renderable & {
	readonly kind: "page";
	readonly endpoint: E;
	readonly method: Method;
	readonly definition: PageDefinition<L, B, S, P>;
	(...deps: LoaderDeps<L>): PageRoute<L, B, S, P, E>;
};

export function page<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
>(
	address: RouteAddress<E>,
	definition: PageDefinition<L, B, S, P> & ThisType<Context<B, S, P, PageRouteRes>>,
): Page<L, B, S, P, E> {
	const { method, endpoint } = resolveRouteAddress(address);
	const id = `${method.toUpperCase()} ${endpoint}`;
	const self: Page<L, B, S, P, E> = defineRenderable(
		"page",
		id,
		definition, // assets
		(...deps: LoaderDeps<L>) => new PageRoute(endpoint, self, deps),
		{ endpoint, method, definition },
	);
	return self;
}

export type AnyPageRoute = PageRoute<any, any, any, any, any>;

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
		const title = this.page.definition.title;
		const state: PageRenderState = {
			layouts,
			title: typeof title === "function" ? title(c) : title,
			from: this.sharedDepth(layouts, mounted),
		};
		c.data.renderState = state;

		c.res.headers.setCacheControl({ public: true, maxAge: 3600, noCache: false });
		c.res.headers.setMany({
			[HeaderKey.ContentType]: "text/html; charset=utf-8",
			[HeaderKey.Vary]: "X-Layouts, Accept-Language, Cookie",
		});

		return runRenderScope(c, async () => {
			if (state.from === 0) {
				const body = await this.renderTree(c, "settled");
				c.res.status = this.status();
				return body.value;
			}

			// Partial: client swaps this into the deepest layout it already has.
			c.res.headers.setMany({
				"X-Slot": layouts[state.from - 1]!.id,
				"X-Title": encodeURIComponent(state.title),
			});

			if (!this.hasLoaders(state)) {
				const body = await this.renderTree(c, "settled");
				c.res.status = this.status();
				return body.value;
			}

			// Streamed: the status is already 200 by the time the loaders settle.
			c.res.headers.set("X-Loading", "1");

			const pending = await this.renderTree(c, "pending");
			const encoder = new TextEncoder();
			return new ReadableStream<Uint8Array>({
				start: async (controller) => {
					controller.enqueue(encoder.encode(pending.value + LOADING_MARKER));
					try {
						const settled = await this.renderTree(c, "settled");
						controller.enqueue(encoder.encode(settled.value));
						controller.close();
					} catch (err) {
						// Headers are already sent; erroring the stream makes the client fall back to a full load.
						controller.error(err);
					}
				},
			});
		});
	};

	hasLoaders(state: PageRenderState): boolean {
		if (this.page.definition.loader) return true;
		return state.layouts.slice(state.from).some((layout) => layout.loader !== undefined);
	}

	status(): number {
		const state = loadedState(this.page);
		if (state?.status !== "error") return Status.OK;
		return state.error instanceof Exception ? state.error.status : Status.INTERNAL_SERVER_ERROR;
	}

	renderTree(c: Context<B, S, P, PageRouteRes>, mode: RenderMode): Promise<Html> {
		setRenderMode(mode);
		return collectAssets(async () => {
			const state = c.data.renderState!;
			// Outermost first, so inner styles win the cascade.
			for (let i = state.from; i < state.layouts.length; i++) useAssets(state.layouts[i]!);
			useAssets(this.page);

			const definition = this.page.definition;
			const loader = definition.loader as AnyLoader | undefined;
			const pageState = await loaderState<LoaderData<L>>(
				this.page,
				loader && (() => loader.apply(c, this.deps as Array<unknown>)),
			);
			let content = await definition.render({ ...pageState, c } as PageRenderProps<
				LoaderData<L>,
				B,
				S,
				P
			>);

			for (let i = state.layouts.length - 1; i >= state.from; i--) {
				const layout = state.layouts[i]!;
				const layoutLoader = layout.loader;
				const layoutState = await loaderState(layout, layoutLoader && (() => layoutLoader.call(c)));
				content = await layout.render({
					...layoutState,
					c,
					title: state.title,
					children: html`<div data-slot="${layout.id}">${content}</div>`,
				});
			}

			// Everything has rendered by now, so every component has registered its assets.
			if (state.from === 0) {
				return (this.document ?? htmlDocument()).render({
					title: state.title,
					styles: renderStyles(),
					scripts: html`${getRouterTag()}${renderScripts()}`,
					body: content,
				});
			}

			return html`${renderStyles()}${content}${renderScripts()}`;
		});
	}

	/** How many of the page's layouts the client already has mounted, matched outermost first. */
	sharedDepth(layouts: Array<Layout<any, any, any, any>>, mounted: Array<string>): number {
		let shared = 0;
		while (shared < layouts.length && mounted[shared] === layouts[shared]!.id) shared++;
		return shared;
	}
}

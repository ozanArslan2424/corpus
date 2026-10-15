import type { Context } from "@ozanarslan/corpus";

import type { AnyPageRoute } from "@/definitions/Page";
import { defineRenderable, type ClientScript, type Renderable } from "@/definitions/Renderable";
import type { LoaderData, LoaderState } from "@/runtime/loaders";
import type { Css } from "@/shared/css";
import type { Html } from "@/shared/html";

export type LayoutLoader<Data = undefined> = () => Bun.MaybePromise<Data>;

export type LayoutRenderProps<
	Data = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> = LoaderState<Data> & {
	c: Context<B, S, P>;
	title: string;
	children: Html;
};

export type LayoutRender<Data = undefined, B = unknown, S = unknown, P = unknown> = (
	props: LayoutRenderProps<Data, B, S, P>,
) => Bun.MaybePromise<Html>;

export interface LayoutDefinition<
	L extends LayoutLoader<any> | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> {
	loader?: L;
	render: LayoutRender<LoaderData<L>, B, S, P>;
	style?: Css;
	script?: ClientScript;
}

export type Layout<
	L extends LayoutLoader<any> | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> = Renderable & {
	readonly kind: "layout";
	readonly render: LayoutRender<LoaderData<L>, B, S, P>;
	readonly loader?: LayoutLoader<LoaderData<L>>;
	(...children: Array<AnyPageRoute | Array<AnyPageRoute>>): Array<AnyPageRoute>;
};

export function layout<
	L extends LayoutLoader<any> | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
>(
	id: string,
	definition: LayoutDefinition<L, B, S, P> & ThisType<Context<B, S, P>>,
): Layout<L, B, S, P> {
	const self: Layout<L, B, S, P> = defineRenderable(
		"layout",
		id,
		definition,
		(...children: Array<AnyPageRoute | Array<AnyPageRoute>>) => {
			const routes = children.flat();
			// Inner layouts are applied first (they're arguments), so prepending keeps the chain outermost first.
			for (const route of routes) route.layouts.unshift(self);
			return routes;
		},
		{ render: definition.render, loader: definition.loader },
	);
	return self;
}

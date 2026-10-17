import type { Context } from "@ozanarslan/corpus";

import {
	defineRenderable,
	type Renderable,
	type RenderableDefinition,
} from "@/definitions/Renderable";
import type { LoaderState, LoaderData } from "@/runtime/loaders";
import type { AnyPageRoute } from "@/server/PageRoute";
import type { Html } from "@/shared/html";

// layouts can't get dependencies
type LayoutLoader = () => any;

export interface LayoutDefinition<
	L extends LayoutLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> extends RenderableDefinition {
	loader?: L;
	render: (
		c: Context<B, S, P> & {
			state: LoaderState<LoaderData<L>>;
			title: string;
			children: Html;
		},
	) => Bun.MaybePromise<Html>;
}

export interface Layout<
	L extends LayoutLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
>
	extends Renderable, LayoutDefinition<L, B, S, P> {
	readonly kind: "layout";
	(...children: Array<AnyPageRoute | Array<AnyPageRoute>>): Array<AnyPageRoute>;
}

export function layout<
	L extends LayoutLoader | undefined = undefined,
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
	);
	return self;
}

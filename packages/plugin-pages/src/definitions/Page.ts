import { Context, resolveRouteAddress, type RouteAddress } from "@ozanarslan/corpus";

import {
	defineRenderable,
	type Renderable,
	type RenderableDefinition,
} from "@/definitions/Renderable";
import type { AnyLoader, LoaderData, LoaderDeps, LoaderState } from "@/runtime/loaders";
import { PageRoute, type PageRouteRes } from "@/server/PageRoute";
import { Html } from "@/shared/html";

export interface PageDefinition<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
> extends RenderableDefinition {
	title?: string;
	loader?: L;
	render: (
		c: Context<B, S, P, PageRouteRes> & { state: LoaderState<LoaderData<L>> },
	) => Bun.MaybePromise<Html>;
}

export interface Page<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
>
	extends Renderable, PageDefinition<L, B, S, P> {
	readonly kind: "page";
	(...deps: LoaderDeps<L>): PageRoute<L, B, S, P, E>;
}

export function page<
	L extends AnyLoader | undefined = undefined,
	B = unknown,
	S = unknown,
	P = unknown,
	E extends string = string,
>(address: RouteAddress<E>, definition: PageDefinition<L, B, S, P>): Page<L, B, S, P, E> {
	const { method, endpoint } = resolveRouteAddress(address);
	const id = `${method.toUpperCase()} ${endpoint}`;
	const self: Page<L, B, S, P, E> = defineRenderable(
		"page",
		id,
		definition, // assets
		(...deps: LoaderDeps<L>) => new PageRoute({ method, endpoint }, self, deps),
	);
	return self;
}

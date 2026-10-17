import {
	defineRenderable,
	type Renderable,
	type RenderableDefinition,
} from "@/definitions/Renderable";
import { useAssets } from "@/runtime/assets";
import {
	renderContext,
	settleLoader,
	type AnyLoader,
	type LoaderData,
	type SettledState,
} from "@/runtime/loaders";
import type { Html } from "@/shared/html";

export interface ComponentDefinition<
	Props extends object = {},
	L extends AnyLoader | undefined = undefined,
> extends RenderableDefinition {
	loader?: L;
	render: (props: Props & { state: SettledState<LoaderData<L>> }) => Bun.MaybePromise<Html>;
}

export type Component<
	Props extends object = {},
	L extends AnyLoader | undefined = undefined,
> = Renderable & {
	readonly kind: "component";
	(
		...args: {} extends Props ? [props?: Props] : [props: Props]
	): [LoaderData<L>] extends [undefined] ? Html : Promise<Html>;
};

export function component<Props extends object = {}, L extends AnyLoader | undefined = undefined>(
	id: string,
	definition: ComponentDefinition<Props, L>,
): Component<Props, L> {
	const self: Component<Props, L> = defineRenderable(
		"component",
		id,
		definition,
		(props?: Props) => {
			useAssets(self);
			const given = (props ?? {}) as Props;
			const loader = definition.loader;

			if (!loader) {
				return definition.render(
					Object.assign(given, {
						state: {
							status: "success",
							data: undefined,
							error: undefined,
						} as SettledState<LoaderData<L>>,
					}),
				);
			}

			return (async () => {
				const c = renderContext();
				const state = await settleLoader(() => loader.call(c, given));
				return definition.render(Object.assign(given, { state }));
			})();
		},
	);
	return self;
}

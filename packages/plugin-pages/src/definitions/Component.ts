import { defineRenderable, type ClientScript, type Renderable } from "@/definitions/Renderable";
import { useAssets } from "@/runtime/collect";
import { renderContext, settleLoader, type AnyContext, type SettledState } from "@/runtime/loaders";
import type { Css } from "@/shared/css";
import type { Html } from "@/shared/html";

export type ComponentLoader<Props extends object = {}, Data = undefined> = (
	props: Props,
) => Bun.MaybePromise<Data>;

export type ComponentRender<Props extends object = {}, Data = undefined> = (
	props: Props,
	state: SettledState<Data>,
) => Html;

export interface ComponentDefinition<Props extends object = {}, Data = undefined> {
	loader?: ComponentLoader<Props, Data>;
	render: ComponentRender<Props, Data>;
	style?: Css;
	script?: ClientScript;
}

export type ComponentResult<Data> = [Data] extends [undefined] ? Html : Promise<Html>;

export type Component<Props extends object = {}, Data = undefined> = Renderable & {
	readonly kind: "component";
	(...args: {} extends Props ? [props?: Props] : [props: Props]): ComponentResult<Data>;
};

export function component<Props extends object = {}, Data = undefined>(
	id: string,
	definition: ComponentDefinition<Props, Data> & ThisType<AnyContext>,
): Component<Props, Data> {
	const self: Component<Props, Data> = defineRenderable(
		"component",
		id,
		definition,
		(props?: Props) => {
			useAssets(self);
			const given = (props ?? {}) as Props;
			const loader = definition.loader;

			if (!loader) {
				return definition.render(given, {
					status: "success",
					data: undefined as Data,
					error: undefined,
				});
			}

			return (async () => {
				const c = renderContext();
				const state = await settleLoader(() => loader.call(c, given));
				return definition.render(given, state);
			})();
		},
	);
	return self;
}

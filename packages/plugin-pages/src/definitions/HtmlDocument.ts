import type { AnyPageRoute } from "@/server/PageRoute";
import { html, type Html } from "@/shared/html";

export interface HtmlDocumentProps {
	title: string;
	styles: Html;
	scripts: Html;
	body: Html;
}

export interface HtmlDocumentDefinition {
	lang?: string;
	colorScheme?: string;
	stylesheets?: Array<string>;
	scripts?: Array<string>;
	head?: () => Html;
}

export type HtmlDocument = {
	render(props: HtmlDocumentProps): Html;
	(...children: Array<AnyPageRoute | Array<AnyPageRoute>>): Array<AnyPageRoute>;
};

export function htmlDocument(definition: HtmlDocumentDefinition = {}): HtmlDocument {
	const self: HtmlDocument = Object.assign(
		(...children: Array<AnyPageRoute | Array<AnyPageRoute>>) => {
			const routes = children.flat();
			for (const route of routes) route.document = self;
			return routes;
		},
		{
			render: (props: HtmlDocumentProps) => {
				const stylesheets = (definition.stylesheets ?? []).map(
					(href) => html`<link rel="stylesheet" href="${href}" />`,
				);
				const scripts = (definition.scripts ?? []).map(
					(src) => html`<script src="${src}" defer></script>`,
				);

				return html`<!doctype html>
					<html lang="${definition.lang ?? "en"}">
						<head>
							<meta charset="utf-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1" />
							<meta name="color-scheme" content="${definition.colorScheme ?? "light dark"}" />
							${stylesheets} ${props.styles} ${scripts} ${definition.head?.()}
							<title>${props.title}</title>
						</head>
						<body>
							${props.body} ${props.scripts}
						</body>
					</html>`;
			},
		},
	);
	return self;
}

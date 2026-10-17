import { select } from "@/shared/style/selectors";
import {
	type StyleRule,
	flattenStyles,
	type StyleBlock,
	type StyleCallback,
	renderRules,
} from "@/shared/style/style";
import { defineVariables } from "@/shared/style/variables";

/** A sheet: selectors at the top level, each with its block. */
type StyleSheetBlock = {
	[selectors: string]: StyleBlock | StyleCallback;
};

/** Every scope handed out in this process. */
const scopes = new Set<string>();
let scopeCount = 0;

function scopeId(): string {
	let id: string;
	do {
		id = `s${(scopeCount++).toString(36)}`;
	} while (scopes.has(id));
	scopes.add(id);
	return id;
}

/** A sheet's scope id and its CSS. Stringifies to the id, so it drops straight into `id="..."`. */
export interface Sheet {
	readonly scope: string;
	toCss(): string;
	toString(): string;
}

/** Every top-level selector is scoped under a generated, non-colliding id. */
export function sheet(block: StyleSheetBlock): Sheet {
	const scope = scopeId();
	const rules: Array<StyleRule> = [];

	flattenStyles(`#${scope}`, block, rules);

	return {
		scope,
		toCss: () => renderRules(rules),
		toString: () => scope,
	};
}

const vars = defineVariables({
	background: "light-dark(hsl(45, 60%, 98%), hsl(30, 25%, 12%))",
	foreground: "light-dark(hsl(29, 25%, 16%), hsl(45, 30%, 95%))",
	border: "light-dark(hsl(40, 40%, 85%), hsl(35, 30%, 25%))",
	ring: "light-dark(hsl(35, 80%, 60%), hsl(35, 70%, 55%))",
	primary: "light-dark(hsl(35, 80%, 20%), hsl(35, 70%, 55%))",
	"primary-foreground": "light-dark(hsl(45, 55%, 97%), hsl(34, 24%, 6%))",
	secondary: "light-dark(hsl(40, 40%, 90%), hsl(35, 30%, 20%))",
	"secondary-foreground": "light-dark(hsl(30, 25%, 25%), hsl(45, 30%, 90%))",
	accent: "light-dark(hsl(30, 60%, 50%), hsl(40, 60%, 75%))",
	"accent-foreground": "light-dark(hsl(45, 55%, 97%), hsl(34, 24%, 6%))",
	destructive: "light-dark(hsl(0, 72%, 51%), hsl(0, 63%, 45%))",
	"destructive-foreground": "hsl(0, 0%, 100%)",

	"radius-xs": "0.25rem",
	radius: "0.65rem",
	"radius-sm": "calc(var(--radius) - 4px)",
	"radius-md": "calc(var(--radius) - 2px)",
	"radius-lg": "var(--radius)",
	"radius-xl": "calc(var(--radius) + 4px)",
	"radius-full": "calc(infinity * 1px)",

	"text-print": "13.5px",
	"text-xs": "0.75rem",
	"text-xs--line-height": "calc(1 / 0.75)",
	"text-sm": "0.875rem",
	"text-sm--line-height": "calc(1.25 / 0.875)",
	"text-base": "1rem",
	"text-base--line-height": "calc(1.5 / 1)",
	"text-lg": "1.125rem",
	"text-lg--line-height": "calc(1.75 / 1.125)",
	"text-xl": "1.25rem",
	"text-xl--line-height": "calc(1.75 / 1.25)",
	"text-2xl": "1.5rem",
	"text-2xl--line-height": "calc(2 / 1.5)",
	"text-3xl": "1.875rem",
	"text-3xl--line-height": "calc(2.25 / 1.875)",
	"text-4xl": "2.25rem",
	"text-4xl--line-height": "calc(2.5 / 2.25)",
	"text-5xl": "3rem",
	"text-5xl--line-height": "1",

	spacing: "0.25rem",
	leading: "1.25",
	"leading-relaxed": "1.625",
	ease: "cubic-bezier(0.4, 0, 0.2, 1)",
	duration: "150ms",
});

declare module "@/shared/style/variables" {
	interface Variables extends Pick<typeof vars, keyof typeof vars> {}
}

const example = sheet({
	".resume-page": {
		display: "flex",
		"flex-direction": "column",
		gap: (vars) => `calc(${vars.spacing} * 2)`,
		"scroll-behavior": "smooth",
		"@media (width >= 40rem)": {
			"margin-top": (vars) => `calc(${vars.spacing} * -8)`,
		},
		".toolbar": {
			display: "flex",
			"align-items": "center",
			"justify-content": "flex-end",
			gap: (vars) => `calc(${vars.spacing} * 2)`,
		},
		".resume-frame": {
			"margin-inline": "auto",
			"max-width": "56rem",
			overflow: "hidden",
			"border-radius": (vars) => `${vars["radius-lg"]}`,
			"border-width": "1px",
		},
		".certificates": {
			display: "grid",
			gap: (vars) => `calc(${vars.spacing} * 3)`,
		},
	},
	"@media print": {
		[select.global("body *")]: {
			visibility: "hidden",
		},
		[select(".print-target", ".print-target *")]: {
			visibility: "visible",
		},
		".print-target": {
			margin: "24px",
			position: "absolute",
			inset: "0",
		},
	},
	"article.resume": {
		width: "100%",
		"aspect-ratio": "1000/1414",
		"@media print": {
			"background-color": "white !important",
		},
		header: {
			"background-color": (vars) => `${vars.secondary}`,
			position: "relative",
			padding: (vars) => `calc(${vars.spacing} * 4)`,
			"@media print": {
				"background-color": "white !important",
			},
			h1: {
				"font-weight": "700",
				"@media (width >= 40rem)": {
					"font-size": (vars) => `${vars["text-5xl"]}`,
					"line-height": (vars) => `${vars["text-5xl--line-height"]}`,
				},
			},
			p: {
				color: (vars) => `color-mix(in oklab, ${vars.foreground} 90%, transparent)`,
			},
		},
		main: {
			display: "grid",
			"grid-template-columns": "repeat(3, minmax(0, 1fr))",
			gap: (vars) => `calc(${vars.spacing} * 10)`,
			padding: (vars) => `calc(${vars.spacing} * 4)`,
			"div.left": {
				order: "2",
				"grid-column": "span 3 / span 3",
				"@media (width >= 40rem)": {
					order: "1",
					"grid-column": "span 2 / span 2",
				},
				section: {
					"margin-bottom": (vars) => `calc(${vars.spacing} * 4)`,
					h2: {
						"margin-bottom": (vars) => `calc(${vars.spacing} * 1)`,
						"font-weight": "900",
					},
					p: {
						"font-size": (vars) => `${vars["text-sm"]}`,
						"line-height": (vars) => `${vars["text-sm--line-height"]}`,
					},
					ul: {
						li: {
							"margin-bottom": (vars) => `calc(${vars.spacing} * 1.5)`,
							h3: {
								display: "flex",
								"justify-content": "space-between",
								"font-weight": "700",
							},
							p: {
								"font-size": (vars) => `${vars["text-sm"]}`,
								"line-height": (vars) => `${vars["text-sm--line-height"]}`,
								"text-wrap": "pretty",
							},
						},
					},
				},
			},
			"div.right": {
				"z-index": "10",
				order: "1",
				"grid-column": "span 3 / span 3",
				"@media (width >= 40rem)": {
					order: "2",
					"grid-column": "span 1 / span 1",
					"margin-top": (vars) => `calc(${vars.spacing} * -26)`,
				},
				img: {
					"margin-bottom": (vars) => `calc(${vars.spacing} * 4)`,
					"aspect-ratio": "1 / 1",
					width: "100%",
				},
				section: {
					"margin-bottom": (vars) => `calc(${vars.spacing} * 4)`,
					h2: {
						"margin-bottom": (vars) => `calc(${vars.spacing} * 1)`,
						"font-size": (vars) => `${vars["text-base"]}`,
						"line-height": (vars) => `${vars["text-base--line-height"]}`,
						"font-weight": "900",
					},
					p: {
						"font-size": (vars) => `${vars["text-sm"]}`,
						"line-height": (vars) => `${vars["text-sm--line-height"]}`,
					},
					ul: {
						li: {
							"margin-bottom": (vars) => `calc(${vars.spacing} * 1)`,
							display: "flex",
							"justify-content": "space-between",
							h4: {
								"font-size": (vars) => `${vars["text-sm"]}`,
								"line-height": (vars) => `${vars["text-sm--line-height"]}`,
								"font-weight": "700",
							},
							[select("p", "a")]: {
								"font-size": (vars) => `${vars["text-sm"]}`,
								"line-height": (vars) => `${vars["text-sm--line-height"]}`,
							},
							"a:hover": {
								"text-decoration-line": "underline",
							},
						},
					},
				},
			},
		},
	},
});

console.log(example.toCss());

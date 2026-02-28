import type { CssValue } from "@/CSS/types/CssValue";

export interface NestedCssProperties {
	[key: string]: CssValue | NestedCssProperties;
}

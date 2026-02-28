import type { CssProperties } from "@/CSS/types/CssProperties";
import type { CssKeyframes } from "@/CSS/types/CssKeyframes";
import type { CssMediaQuery } from "@/CSS/types/CssMediaQuery";

export interface CssRule {
	selector: string;
	properties: CssProperties;
	mediaQueries?: CssMediaQuery[];
	pseudoClasses?: {
		hover?: CssProperties;
		active?: CssProperties;
		focus?: CssProperties;
		visited?: CssProperties;
		disabled?: CssProperties;
		checked?: CssProperties;
		[key: string]: CssProperties | undefined;
	};
	pseudoElements?: {
		before?: CssProperties;
		after?: CssProperties;
		placeholder?: CssProperties;
		selection?: CssProperties;
		[key: string]: CssProperties | undefined;
	};
	keyframes?: {
		[name: string]: CssKeyframes;
	};
}

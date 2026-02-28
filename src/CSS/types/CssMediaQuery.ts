import type { CssProperties } from "@/CSS/types/CssProperties";

export interface CssMediaQuery {
	condition: string;
	rules: CssProperties;
}

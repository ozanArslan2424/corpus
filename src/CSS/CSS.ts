import type { CssProperties } from "@/CSS/types/CssProperties";
import type { CssRule } from "@/CSS/types/CssRule";
import type { CssValue } from "@/CSS/types/CssValue";
import type { NestedCssProperties } from "@/CSS/types/NestedCssProperties";
// import * as esbuild from "esbuild";

export class CSS {
	// TODO: File Caching
	// static async minify(content: string): Promise<string> {
	// 	const result = await esbuild.transform(content, {
	// 		loader: "css",
	// 		minify: true,
	// 	});
	// 	return result.code;
	// }

	static build(rules: CssRule[]): string {
		return rules.map((rule) => this.ruleToString(rule)).join("\n\n");
	}

	private static formatValue(
		key: string,
		value: CssValue | NestedCssProperties,
	): string {
		if (value === undefined || value === null) {
			return "";
		}

		// Handle nested properties (like transform with multiple values)
		if (typeof value === "object" && !Array.isArray(value)) {
			return Object.entries(value)
				.map(([k, v]) => this.formatValue(k, v))
				.filter(Boolean)
				.join(" ");
		}

		// Add units to numeric values where appropriate
		if (typeof value === "number" && !this.isUnitlessProperty(key)) {
			return `${value}px`;
		}

		return String(value);
	}

	private static isUnitlessProperty(property: string): boolean {
		const unitlessProps = [
			"opacity",
			"zIndex",
			"fontWeight",
			"flex",
			"flexGrow",
			"flexShrink",
			"order",
			"zoom",
			"animationIterationCount",
			"columnCount",
			"orphans",
			"widows",
			"lineHeight", // lineHeight can be unitless (multiplier) or with units
		];

		return unitlessProps.includes(property);
	}

	private static propertiesToString(properties: CssProperties): string {
		return Object.entries(properties)
			.map(([key, value]) => {
				if (value === undefined || value === null) {
					return "";
				}

				// Convert camelCase to kebab-case
				const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
				const cssValue = this.formatValue(key, value);

				return cssValue ? `  ${cssKey}: ${cssValue};` : "";
			})
			.filter(Boolean)
			.join("\n");
	}

	static ruleToString(rule: CssRule): string {
		const parts: string[] = [];

		if (rule.keyframes) {
			Object.entries(rule.keyframes).forEach(([name, keyframes]) => {
				parts.push(`@keyframes ${name} {`);
				Object.entries(keyframes).forEach(([step, properties]) => {
					parts.push(`  ${step} {`);
					parts.push(this.propertiesToString(properties));
					parts.push(`  }`);
				});
				parts.push(`}`);
			});
		}

		parts.push(`${rule.selector} {`);
		parts.push(this.propertiesToString(rule.properties));
		parts.push(`}`);

		if (rule.pseudoClasses) {
			Object.entries(rule.pseudoClasses).forEach(([pseudo, properties]) => {
				if (properties && Object.keys(properties).length > 0) {
					parts.push(`${rule.selector}:${pseudo} {`);
					parts.push(this.propertiesToString(properties));
					parts.push(`}`);
				}
			});
		}

		if (rule.pseudoElements) {
			Object.entries(rule.pseudoElements).forEach(([element, properties]) => {
				if (properties && Object.keys(properties).length > 0) {
					parts.push(`${rule.selector}::${element} {`);
					parts.push(this.propertiesToString(properties));
					parts.push(`}`);
				}
			});
		}

		if (rule.mediaQueries) {
			rule.mediaQueries.forEach((mq) => {
				parts.push(`@media ${mq.condition} {`);
				parts.push(`  ${rule.selector} {`);
				parts.push(this.propertiesToString(mq.rules).replace(/^/gm, "  "));
				parts.push(`  }`);
				parts.push(`}`);
			});
		}

		return parts.join("\n");
	}
}

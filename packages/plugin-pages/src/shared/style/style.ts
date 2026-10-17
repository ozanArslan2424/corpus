import { resolveNestedSelector } from "@/shared/style/selectors";
import { type Variables, variableProxy } from "@/shared/style/variables";

type DeclarationValue = string | number;

export type StyleCallback = (vars: Variables) => DeclarationValue | StyleBlock;

/** Declarations, plus nested selectors and at-rules relative to the block's own selector. */
export type StyleBlock = {
	[property: string]: DeclarationValue | StyleBlock | StyleCallback;
};

export interface StyleRule {
	selector: string;
	/** At-rule preludes this rule sits inside, outermost first. */
	conditions: Array<string>;
	declarations: Array<string>;
}

/** Resolves a function value down to a declaration value or a nested style block. */
export function resolveStyleValue(
	value: DeclarationValue | StyleBlock | StyleCallback,
): DeclarationValue | StyleBlock {
	return typeof value === "function" ? resolveStyleValue(value(variableProxy())) : value;
}

export function flattenStyles(
	selector: string,
	block: DeclarationValue | StyleBlock,
	rules: Array<StyleRule>,
	conditions: Array<string> = [],
): void {
	const declarations: Array<string> = [];
	const nestedBlocks: Array<[string, StyleBlock]> = [];

	for (const [property, rawValue] of Object.entries(block)) {
		const value = resolveStyleValue(rawValue);
		const isDeclaration = typeof value === "string" || typeof value === "number";
		if (isDeclaration) {
			declarations.push(`${property}:${value};`);
		} else {
			nestedBlocks.push([property, value]);
		}
	}

	if (declarations.length > 0) rules.push({ selector, conditions, declarations });

	for (const [nestedKey, nestedBlock] of nestedBlocks) {
		const key = nestedKey.trim();
		// An at-rule wraps its contents; the selector it applies to is unchanged.
		if (key.startsWith("@")) {
			flattenStyles(selector, nestedBlock, rules, [...conditions, key]);
		} else {
			flattenStyles(resolveNestedSelector(selector, key), nestedBlock, rules, conditions);
		}
	}
}

interface ConditionNode {
	rules: Array<StyleRule>;
	children: Map<string, ConditionNode>;
}

function conditionNode(): ConditionNode {
	return { rules: [], children: new Map() };
}

function renderNode(node: ConditionNode): string {
	let css = "";
	for (const rule of node.rules) css += `${rule.selector}{${rule.declarations.join("")}}`;
	for (const [condition, child] of node.children) css += `${condition}{${renderNode(child)}}`;
	return css;
}

/**
 * Rules grouped by their at-rule path, so each prelude is emitted once however many rules sit under it.
 * Within a group, source order is preserved; a group appears where its first rule did.
 */
export function renderRules(rules: Array<StyleRule>): string {
	const root = conditionNode();

	for (const rule of rules) {
		let node = root;
		for (const condition of rule.conditions) {
			let child = node.children.get(condition);
			if (!child) {
				child = conditionNode();
				node.children.set(condition, child);
			}
			node = child;
		}
		node.rules.push(rule);
	}

	return renderNode(root);
}

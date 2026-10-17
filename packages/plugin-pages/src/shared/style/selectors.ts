/** Marks a selector as unscoped. A control character so it can never appear in real CSS. */
const GLOBAL = "\u0000";

interface Select {
	(...selectorList: Array<string>): string;
	/** Escapes the scope: these selectors are emitted as written, with no scope or parent prepended. */
	global(...selectorList: Array<string>): string;
}

const select = ((...selectors: Array<string>): string => selectors.join(", ")) as Select;

select.global = (...selectors: Array<string>): string =>
	selectors.map((selector) => GLOBAL + selector.trim()).join(", ");

function splitSelectorList(selectorList: string): Array<string> {
	return selectorList
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * The nesting selector `&` is replaced by the parent; anything else is a descendant of it.
 * A selector marked by `select.global` ignores the parent entirely.
 */
function resolveNestedSelector(parentList: string, nestedList: string): string {
	return splitSelectorList(nestedList)
		.flatMap((nested) => {
			if (nested.startsWith(GLOBAL)) return [nested.slice(GLOBAL.length)];
			return splitSelectorList(parentList).map((parent) =>
				nested.includes("&") ? nested.replace(/&/g, parent) : `${parent} ${nested}`,
			);
		})
		.join(", ");
}

export { select, splitSelectorList, resolveNestedSelector };

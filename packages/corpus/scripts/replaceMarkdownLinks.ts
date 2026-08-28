export function replaceMarkdownLinks(
	text: string,
	callback: (label: string, url: string) => string,
): string {
	return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => callback(label, url));
}

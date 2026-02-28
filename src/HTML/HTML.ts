import type { HtmlSkeleton } from "@/HTML/types/HtmlSkeleton";

export class HTML {
	// prettier-ignore
	static build(sk: HtmlSkeleton): string {
		const lines: string[] = [];

		const add = (tag: string, attr: { [key: string]: string | number }) =>
			lines.push(
				`<${tag} ${Object.entries(attr).map(([key, value]) => `${key}="${value}"`).join(" ")}>`,
			);

		add("meta", { charset: sk.charset ?? "UTF-8" });
		add("meta", { name: "viewport", content: sk.viewport ?? "width=device-width, initial-scale=1.0" });
		if (sk.description) add("meta", { name: "description", content: sk.description });
		if (sk.keywords?.length) add("meta", { name: "keywords", content: sk.keywords.join(", ") });
		if (sk.author) add("meta", { name: "author", content: sk.author });
		if (sk.robots) add("meta", { name: "robots", content: sk.robots });
		if (sk.canonical) add("link", { rel: "canonical", href: sk.canonical })
		if (sk.metas) {
			for (const m of sk.metas) {
				if (m.name) {
					add("meta", { name: m.name, content: m.content });
				} else if (m.property) {
					add("meta", { property: m.property, content: m.content });
				} else if (m.httpEquiv) {
					add("meta", { "http-equiv": m.httpEquiv, content: m.content });
				}
			}
		}
		if (sk.og) {
			if (sk.og.title) add("meta", { property: "og:title", content: sk.og.title });
			if (sk.og.description) add("meta", { property: "og:description", content: sk.og.description });
			if (sk.og.image) add("meta", { property: "og:image", content: sk.og.image });
			if (sk.og.url) add("meta", { property: "og:url", content: sk.og.url });
			if (sk.og.type) add("meta", { property: "og:type", content: sk.og.type });
			if (sk.og.siteName) add("meta", { property: "og:site_name", content: sk.og.siteName });
			if (sk.og.locale) add("meta", { property: "og:locale", content: sk.og.locale });
		}
		if (sk.twitter) {
			if (sk.twitter.card) add("meta", { property: "twitter:card", content: sk.twitter.card });
			if (sk.twitter.site) add("meta", { property: "twitter:site", content: sk.twitter.site });
			if (sk.twitter.creator) add("meta", { property: "twitter:creator", content: sk.twitter.creator });
			if (sk.twitter.title) add("meta", { property: "twitter:title", content: sk.twitter.title });
			if (sk.twitter.description) add("meta", { property: "twitter:description", content: sk.twitter.description });
			if (sk.twitter.image) add("meta", { property: "twitter:image", content: sk.twitter.image });
			if (sk.twitter.imageAlt) add("meta", { property: "twitter:image:alt", content: sk.twitter.imageAlt });
			if (sk.twitter.player) {
				add("meta", { property: "twitter:player", content: sk.twitter.player });
				if (sk.twitter.playerWidth) add("meta", { property: "twitter:player:width", content: sk.twitter.playerWidth });
				if (sk.twitter.playerHeight) add("meta", { property: "twitter:player:height", content: sk.twitter.playerHeight });
			}
			if (sk.twitter.appId) {
				if (sk.twitter.appId.iphone)  add("meta", { property: "twitter:app:id:iphone", content: sk.twitter.appId.iphone });
				if (sk.twitter.appId.ipad)  add("meta", { property: "twitter:app:id:ipad", content: sk.twitter.appId.ipad });
				if (sk.twitter.appId.googleplay)  add("meta", { property: "twitter:app:id:googleplay", content: sk.twitter.appId.googleplay });
			}
		}
		if (sk.base) {
			if (sk.base.target) {
				add("base", { href: sk.base.href, target: sk.base.target })
			} else {
				add("base", { href: sk.base.href })
			}
		}
		if (sk.favicons) {
			for (const f of sk.favicons) {
				const attr: Record<string, string> = { rel: f.rel, href: f.href }
				if (f.sizes) attr.sizes = f.sizes
				if (f.type) attr.type = f.type
				if (f.color) attr.color = f.color
				add("link", attr)
			}
		}
		if (sk.links) {
			for (const l of sk.links) {
				const attr: Record<string, string> = { rel: l.rel, href: l.href }
				if (l.type) attr.type = l.type
				if (l.sizes) attr.sizes = l.sizes
				if (l.media) attr.media = l.media
				if (l.integrity) attr.integrity = l.integrity
				if (l.crossorigin) attr.crossorigin = l.crossorigin
				if (l.referrerpolicy) attr.referrerpolicy = l.referrerpolicy
				if (l.as) attr.as = l.as
				if (l.hreflang) attr.hreflang = l.hreflang
				if (l.title) attr.title = l.title
				add("link", attr)
			}
		}
		if (sk.jsonLd) {
			for (const [i, j] of sk.jsonLd.entries()) {
				lines.push(`<script type="application/ld+json" id="structured-data-${i + 1}">${JSON.stringify(j, null)}</script>`)
			}
		}
		if (sk.scripts) {
			for (const s of sk.scripts) {
				const attrs: string[] = [];
				if (s.src) attrs.push(`src="${s.src}"`);
				if (s.type) attrs.push(`type="${s.type}"`);
				if (s.async) attrs.push("async");
				if (s.defer) attrs.push("defer");
				if (s.integrity) attrs.push(`integrity="${s.integrity}"`);
				if (s.crossorigin) attrs.push(`crossorigin="${s.crossorigin}"`);
				if (s.referrerpolicy) attrs.push(`referrerpolicy="${s.referrerpolicy}"`);
				if (s.nomodule) attrs.push("nomodule");
				if (s.content) {
					lines.push(`<script ${attrs.join(" ")}>${s.content}</script>`);
				} else {
					lines.push(`<script ${attrs.join(" ")}></script>`);
				}
			}
		}
		const html = [
			"<!DOCTYPE html>",
			`<html lang="${sk.lang}">`,
			"<head>",
			`<title>${sk.title}</title>`,
			...lines,
			"</head>",
			"<body>",
			sk.contents,
			"</body>",
			"</html>",
		];
		return html.join("\n");
	}
}

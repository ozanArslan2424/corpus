import { transform } from "esbuild";
import terser from "html-minifier-terser";

export class Minifier {
	async javascript(code: string) {
		try {
			const result = await transform(code, { loader: "js", minify: true, sourcemap: false });
			return result.code;
		} catch (err) {
			console.error("minifyJS fail:", err);
			return code;
		}
	}

	async css(code: string) {
		try {
			const result = await transform(code, { loader: "css", minify: true, sourcemap: false });
			return result.code;
		} catch (err) {
			console.error("minifyCSS fail:", err);
			return code;
		}
	}

	async html(code: string) {
		try {
			const result = await terser.minify(code, {
				collapseWhitespace: true,
				removeComments: true,
				removeOptionalTags: true,
				removeRedundantAttributes: true,
				removeScriptTypeAttributes: true,
				removeStyleLinkTypeAttributes: true,
				useShortDoctype: true,
			});
			return result;
		} catch (err) {
			console.error("minifyHTML fail:", err);
			return code;
		}
	}

	async scriptTags(html: string) {
		const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
		const matches = Array.from(html.matchAll(scriptRegex));

		let resultHtml = html;

		for (const match of matches) {
			const fullMatch = match[0];
			const attributes = match[1];
			const code = match[2];

			if (!code || code.trim().length === 0) continue;

			const compiledJs = await this.javascript(code);
			const newTag = `<script${attributes}>${compiledJs}</script>`;
			resultHtml = resultHtml.replace(fullMatch, newTag);
		}

		return resultHtml;
	}
}

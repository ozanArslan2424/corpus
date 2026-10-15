import { BundleRoute, App, type AppInterface } from "@ozanarslan/corpus";

import { writeAssets } from "@/builder/writeAssets";

type BrowserAppOptions = ConstructorParameters<typeof App>[0] & {
	/**
	 * Directory that collected assets are written into, as `styles/` and `scripts/`, and that is served
	 * at `assetsServePath`. Defaults to `"public"`.
	 */
	assetsOutDir?: string;
	/**
	 * URL path `assetsOutDir` is served under. Normalized to a slash-separated path ending in `/*`, so
	 * `"assets"`, `"/assets/"` and `"/assets/*"` all become `/assets/*`. Defaults to `"/*"`.
	 */
	assetsServePath?: string;
};

/** Normalizes to `/a/b/*`: forward slashes, one leading slash, no empty segments, exactly one trailing `*`. */
function fixPath(input: string): string {
	const segments = input
		.replace(/\\/g, "/")
		.replace(/[/*]+$/, "")
		.split("/")
		.filter(Boolean);

	return segments.length > 0 ? `/${segments.join("/")}/*` : "/*";
}

export class BrowserApp extends App implements AppInterface {
	constructor(opts?: BrowserAppOptions) {
		super(opts);
		if (opts?.assetsOutDir) this.assetsOutDir = opts.assetsOutDir;
		if (opts?.assetsServePath) this.assetsServePath = fixPath(opts.assetsServePath);
	}

	private readonly assetsOutDir: string = "public";
	private readonly assetsServePath: string = "/*";

	override async listen(): Promise<void> {
		// "/assets/*" → "/assets/", so asset URLs match where the directory is served.
		await writeAssets(this.assetsOutDir, this.assetsServePath.slice(0, -1));
		new BundleRoute(this.assetsServePath, this.assetsOutDir);
		await super.listen();
	}
}

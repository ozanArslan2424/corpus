import { BundleRoute, App, type AppInterface } from "@ozanarslan/corpus";

import { bundle } from "@/bundler/bundle";
import { ASSETS_SERVE_PATH } from "@/shared/constants";

type BrowserAppOptions = ConstructorParameters<typeof App>[0] & {
	/**
	 * Directory that collected assets are written into, as `styles/` and `scripts/`, and that is served
	 * at `assetsServePath`. Defaults to `"public"`.
	 */
	assetsOutDir?: string;
};

export class BrowserApp extends App implements AppInterface {
	constructor(opts?: BrowserAppOptions) {
		super(opts);
		if (opts?.assetsOutDir) this.assetsOutDir = opts.assetsOutDir;
	}

	readonly assetsOutDir: string = ".corpus";

	override async listen(): Promise<void> {
		try {
			await bundle(this.assetsOutDir);
		} catch (err) {
			console.error(err);
			await this.close(true);
		}
		new BundleRoute(ASSETS_SERVE_PATH, this.assetsOutDir);
		await super.listen();
	}
}

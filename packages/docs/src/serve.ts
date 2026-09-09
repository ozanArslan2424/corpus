import { C } from "@ozanarslan/corpus";

export async function serve(outdir: string) {
	const app = new C.App({ port: 3000 });

	const bundle = new C.BundleRoute("/*", outdir);

	// for non-bundle routes that may be added in the future
	new C.RateLimiter();

	new C.Middleware({
		handler: (c) => {
			console.log(
				`[${new Date().toISOString()}] ${c.req.method} ${c.url.pathname} -> ${c.res.status}`,
			);
		},
	});

	app.handleBeforeListen = () => {
		console.table(bundle.getEndpoints().map((endpoint) => ({ method: "GET", endpoint })));
	};

	await app.listen();
}

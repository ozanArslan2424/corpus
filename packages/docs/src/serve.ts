import { C } from "@ozanarslan/corpus";

export async function serve(outdir: string) {
	const server = new C.Server();
	new C.BundleRoute("/*", outdir);
	await server.listen(3000);
}

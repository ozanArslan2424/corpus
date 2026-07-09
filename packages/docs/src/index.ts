import { C } from "@ozanarslan/corpus";

import { compile } from "@/compile";

async function main() {
	const outdir = await compile();
	const server = new C.Server();
	new C.BundleRoute("/*", outdir);
	await server.listen(3000);
}

await main();

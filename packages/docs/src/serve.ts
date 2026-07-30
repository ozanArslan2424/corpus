import fs from "fs";
import path from "path";

import { C, X } from "@ozanarslan/corpus";

function getMaxAge(addr: string) {
	// CSS/JS: unhashed but low-churn, safe to cache for an hour between deploys
	if (addr.startsWith("/styles/") || addr.startsWith("/scripts/")) {
		return 3600;
	}
	// meta files: change only on redeploy, moderate caching is fine
	if (
		addr === "/robots.txt" ||
		addr === "/sitemap.xml" ||
		addr === "/llms.txt" ||
		addr === "/llms-full.txt"
	) {
		return 3600;
	}
	// doc pages (.html/.md) and "/": want freshness, short cache window
	return 300;
}

function registerStatic(addr: string, filePath: string) {
	new C.StaticRoute(addr, { filePath, cache: { public: true, maxAge: getMaxAge(addr) } });
}

function walk(dir: string, outdir: string) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, outdir);
			continue;
		}
		const addr = `/${path.relative(outdir, full).split(path.sep).map(encodeURIComponent).join("/")}`;
		registerStatic(addr, full);
		// root index.html is also reachable at "/"
		if (addr === "/index.html") registerStatic("/", full);
	}
}

export async function serve(outdir: string) {
	const server = new C.Server();
	walk(outdir, outdir);
	new X.RateLimiter();
	new C.Middleware({
		variant: "outbound",
		handler: (c) => {
			console.log(
				`[${new Date().toISOString()}] ${c.req.method} ${c.url.pathname} -> ${c.res.status}`,
			);
		},
	});

	server.setOnBeforeListen(() => {
		console.table(server.routes.map(({ method, endpoint }) => ({ method, endpoint })));
	});

	await server.listen(3000);
}

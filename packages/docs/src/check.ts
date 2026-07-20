import fs from "fs";
import os from "os";
import path from "path";

import { compileNoWrite } from "@/compile";
import type { RouteFile } from "@/types";

type BrokenHref = {
	outPath: string;
	href: string;
};

function getValidAddrs(routeFiles: Array<RouteFile>, outdir: string): Set<string> {
	const valid = new Set<string>();
	for (const rf of routeFiles) {
		valid.add(rf.addr);
		// outPath form too, in case an href was built from the file layout
		valid.add(path.join("/", path.relative(outdir, rf.outPath)));
		// index.html is reachable as its directory
		if (rf.addr.endsWith("/index.html")) {
			valid.add(rf.addr.slice(0, -"index.html".length));
		}
	}
	valid.add("/");
	return valid;
}

function getNormalizedHref(href: string): string | null {
	const trimmed = href.trim();
	if (trimmed === "") return null;
	// external, protocol-relative, anchors, and non-http schemes are not ours
	if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed)) return null;
	if (trimmed.startsWith("#")) return null;

	const withoutHash = trimmed.split("#")[0]!;
	const withoutQuery = withoutHash.split("?")[0]!;
	if (withoutQuery === "") return null;

	// relative hrefs are not resolvable without a base, flag them instead
	if (!withoutQuery.startsWith("/")) return withoutQuery;

	return path.posix.normalize(withoutQuery);
}

function checkHrefs(
	outFilesMap: Map<string, string>,
	routeFiles: Array<RouteFile>,
	outdir: string,
): Array<BrokenHref> {
	const valid = getValidAddrs(routeFiles, outdir);
	const broken: Array<BrokenHref> = [];

	for (const [outPath, content] of outFilesMap.entries()) {
		if (!outPath.endsWith(".html")) continue;

		const matches = content.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/gi);
		for (const match of matches) {
			const raw = match[1]!;
			const href = getNormalizedHref(raw);
			if (href === null) continue;

			if (href.startsWith("#") || href.startsWith("http") || href.startsWith("${")) {
				continue;
			}

			if (!href.startsWith("/")) {
				broken.push({ outPath, href: `${raw} (relative href, cannot resolve)` });
				continue;
			}

			if (!valid.has(href)) {
				broken.push({ outPath, href: raw });
			}
		}
	}

	return broken;
}

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
const { routeFiles, outFilesMap } = await compileNoWrite(outdir);
const broken = checkHrefs(outFilesMap, routeFiles, outdir);
console.log(broken);

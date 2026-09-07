/**
 * One-time framework setup.
 *
 * {@link initialize} creates the global registries and installs the `Request`
 * and `Headers` extensions the rest of corpus assumes are present. It runs when
 * the package is imported, so nothing normally needs to call it.
 *
 * @module initialize
 */

import { getOrInitAppsRegistry } from "@/AppsRegistry";
import { Globals } from "@/Globals";
import { patchGlobalHeaders } from "@/Headers";
import { getOrInitParsersRegistry } from "@/ParsersRegistry";
import { patchGlobalRequest } from "@/Request";

/**
 * Prepares the process for corpus: creates the {@link AppsRegistry} and
 * {@link ParsersRegistry}, then applies {@link patchGlobalRequest} and
 * {@link patchGlobalHeaders}.
 *
 * Guarded through {@link Globals}, so it runs at most once per process however
 * many times it is called — which matters because the patches wrap the previous
 * implementation, and applying them twice would layer one wrapper on another.
 * The flag is set before the work rather than after, so a re-entrant call during
 * setup is caught too.
 */
export function initialize() {
	if (Globals.has("initialized")) return;
	Globals.set("initialized", true);
	getOrInitAppsRegistry();
	getOrInitParsersRegistry();
	patchGlobalRequest();
	patchGlobalHeaders();
}

/**
 * Process-wide registry of every {@link AppInterface} instance that has been
 * constructed.
 *
 * The registry is what lets {@link RouteBase} implementations and
 * {@link Middleware} attach themselves without being handed an app: they call
 * {@link getNearestApp} and find the most recently constructed one. The array
 * lives on {@link Globals}, so it survives module re-evaluation and is shared
 * across the whole process.
 *
 * @module AppsRegistry
 */

import type { AppInterface } from "@/App";
import { Globals } from "@/Globals";
import { assertDefined } from "@/utils/assert";

/**
 * The registry itself: every {@link AppInterface} in construction order, oldest
 * first. The last entry is the one {@link getNearestApp} resolves to.
 */
type AppsRegistry = Array<AppInterface>;

/**
 * Reads the registry from {@link Globals}, creating an empty one on first
 * access.
 *
 * @returns The shared {@link AppsRegistry}. The array is live — mutating it
 * mutates the registry.
 */
function getOrInitAppsRegistry(): AppsRegistry {
	try {
		return Globals.get("apps");
	} catch {
		return Globals.create("apps", () => []);
	}
}

/**
 * Resolves the {@link AppInterface} that newly constructed routes and
 * middlewares should attach to: the most recently registered one.
 *
 * With a single app — the common case — this is simply that app. With several,
 * "nearest" means last constructed, so an app must be instantiated before the
 * routes belonging to it.
 *
 * @returns The most recently registered {@link AppInterface}.
 * @throws {@link Error} when no app has been constructed yet.
 */
function getNearestApp(): AppInterface {
	const apps = getOrInitAppsRegistry();
	const current = apps[apps.length - 1];
	assertDefined(current, "No active App, instantiate one first");
	return current;
}

/**
 * Appends an app to the registry, making it the one {@link getNearestApp}
 * returns. Called by the {@link App} constructor; there is no reason to call it
 * by hand.
 *
 * @param app - The {@link AppInterface} to register.
 */
function registerApp(app: AppInterface): void {
	const apps = getOrInitAppsRegistry();
	apps.push(app);
}

export { type AppsRegistry, getOrInitAppsRegistry, getNearestApp, registerApp };

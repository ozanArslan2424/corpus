import type { AppInterface } from "@/App";
import { Globals } from "@/Globals";
import { assertDefined } from "@/utils/assert";

type AppsRegistry = Array<AppInterface>;

function getOrInitAppsRegistry(): AppsRegistry {
	try {
		return Globals.get("apps");
	} catch {
		return Globals.create("apps", () => []);
	}
}

function getNearestApp(): AppInterface {
	const apps = getOrInitAppsRegistry();
	const current = apps[apps.length - 1];
	assertDefined(current, "No active App, instantiate one first");
	return current;
}

function registerApp(app: AppInterface): void {
	const apps = getOrInitAppsRegistry();
	apps.push(app);
}

export type { AppsRegistry };
export { getOrInitAppsRegistry, getNearestApp, registerApp };

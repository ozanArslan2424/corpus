import { getOrInitAppsRegistry } from "@/AppsRegistry";
import { Globals } from "@/Globals";
import { patchGlobalHeaders } from "@/Headers";
import { getOrInitParsersRegistry } from "@/ParsersRegistry";
import { patchGlobalRequest } from "@/Request";

export function initialize() {
	if (Globals.has("initialized")) return;

	Globals.set("initialized", true);

	getOrInitAppsRegistry();
	getOrInitParsersRegistry();

	patchGlobalRequest();
	patchGlobalHeaders();
}

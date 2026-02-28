import type { Router } from "@/Router/Router";

let RouterInstance: Router;

export function getRouterInstance(): Router {
	if (!RouterInstance) {
		console.error(
			"Router instance is not set. Please instantiate your Server before your routes.",
		);
		process.exit(1);
	}
	return RouterInstance;
}

export function setRouterInstance(router: Router): void {
	RouterInstance = router;
}

import * as C from "@/exports";

export * from "@/exports";

export { C };

export default C;

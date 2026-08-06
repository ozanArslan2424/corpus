import { logger } from "@/utils/logger";
import type { nil } from "@/utils/types";

import {
	$registryTesting,
	TC,
	type RouterInterface,
	type ServerApp,
	type ServerOptions,
} from "../_modules";

export function createTestServer(
	opts?: ServerOptions & { withLogging?: boolean; router?: RouterInterface },
) {
	const { withLogging, router, ...serverOpts } = opts ?? {
		withLogging: false,
	};

	if (router) {
		$registryTesting.router = router;
	}

	class Server extends TC.Server {
		compiled = false;
		override handle(request: Request, server?: ServerApp | nil): Promise<Response> {
			this.compile();
			return super.handle(request, server);
		}
	}

	const s = new Server(serverOpts);

	if (withLogging === true) {
		s.setOnError((err, c) => {
			logger.error("thrown error", err);
			return s.defaultErrorHandler(err, c);
		});

		s.setOnNotFound((req) => {
			logger.error("not found request", req);
			return s.defaultNotFoundHandler(req);
		});
	}

	return s;
}

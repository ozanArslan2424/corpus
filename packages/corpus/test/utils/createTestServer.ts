import { logger } from "@/utils/logger";
import type { nil } from "@/utils/types";

import {
	$registryTesting,
	TC,
	type RouterInterface,
	type ServerApp,
	type ServerOptions,
} from "../_modules";
import { TEST_PORT } from "./req";

export function createTestServer(
	opts?: ServerOptions & { withLogging?: boolean; router?: RouterInterface },
) {
	const { withLogging, router, ...serverOpts } = opts ?? {
		port: TEST_PORT,
		withLogging: false,
	};

	if (router) {
		$registryTesting.router = router;
	}

	class Server extends TC.Server {
		compiled = false;
		override handle(request: Request, server?: ServerApp | nil): Promise<Response> {
			this.composeHandlers();
			return super.handle(request, server);
		}
	}

	const s = new Server(serverOpts);

	if (withLogging === true) {
		const defaultErrorHandler = s.handleError;
		const defaultNotFoundHandler = s.handleNotFound;
		s.handleError = (err, c) => {
			logger.error("thrown error", err);
			return defaultErrorHandler(err, c);
		};

		s.handleNotFound = (req) => {
			logger.error("not found request", req);
			return defaultNotFoundHandler(req);
		};
	}

	return s;
}

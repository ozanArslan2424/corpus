import { logger } from "@ozanarslan/utils";

import { $registry, C, type RouterInterface, type ServerOptions } from "#corpus";
import { TEST_PORT } from "./req";

export function createTestServer(
	opts?: ServerOptions & { withLogging?: boolean; router?: RouterInterface },
) {
	const { withLogging, router, ...serverOpts } = opts ?? {
		port: TEST_PORT,
		withLogging: false,
	};

	if (router) {
		$registry.router = router;
	}

	const s = router ? new C.ServerWithRouter({ ...serverOpts, router }) : new C.Server(serverOpts);

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

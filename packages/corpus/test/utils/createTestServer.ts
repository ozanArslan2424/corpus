import { logger } from "@/utils/logger";

import { $registryTesting, TC, type RouterInterface, type ServerOptions } from "../_modules";

export function createTestServer(
	opts?: ServerOptions & { withLogging?: boolean; router?: RouterInterface },
) {
	const { withLogging, router, ...serverOpts } = opts ?? {
		withLogging: false,
	};

	if (router) {
		$registryTesting.router = router;
	}

	const s = new TC.Server(serverOpts);

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

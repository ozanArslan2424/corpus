import { logger } from "@/utils/logger";

import { $registryTesting, TC, type RouterAdapterInterface, type ServerOptions } from "../_modules";

export function createTestServer(
	opts?: ServerOptions & { withLogging?: boolean; adapter?: RouterAdapterInterface },
) {
	const { withLogging, adapter, ...serverOpts } = opts ?? {
		withLogging: false,
	};

	if (adapter) {
		$registryTesting.adapter = adapter;
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

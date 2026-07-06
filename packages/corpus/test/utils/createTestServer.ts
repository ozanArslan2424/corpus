import { logger } from "@/utils/logger";

import { TC, type ServerOptions } from "../_modules";

export function createTestServer(opts?: ServerOptions & { withLogging?: boolean }) {
	const { withLogging, ...serverOpts } = opts ?? {
		withLogging: false,
	};
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

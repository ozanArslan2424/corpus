import C from "@/index";

export function createTestServer(opts?: { withLogging: boolean }) {
	const s = new C.Server();

	if (opts?.withLogging) {
		s.setOnError((err) => {
			console.error("thrown error", err);
			if (!(err instanceof Error)) {
				return new C.Response(
					{ error: err, message: "Unknown" },
					{ status: C.Status.INTERNAL_SERVER_ERROR },
				);
			}

			if (err instanceof C.Error) {
				return err.toResponse();
			}
			return new C.Response(
				{ error: err, message: err.message },
				{ status: C.Status.INTERNAL_SERVER_ERROR },
			);
		});

		s.setOnNotFound((req) => {
			console.error("not found request", req);
			return new C.Response(
				{ error: true, message: `${req.method} on ${req.url} does not exist.` },
				{ status: C.Status.NOT_FOUND },
			);
		});
	}

	return s;
}

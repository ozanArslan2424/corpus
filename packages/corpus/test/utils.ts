import type { Res } from "@/C/Res/Res";
import { joinPathSegments } from "@/C/RouteBase/joinPathSegments";
import { Server } from "@/C/Server/Server";
import type { ServerOptions } from "@/C/Server/Server.types";
import { ServerWithRouter } from "@/C/Server/ServerWithRouter";
import { $registry } from "@/Registry/$registry";
import type { RouterInterface } from "@/Registry/Registry.types";
import { logger } from "@/utils";

export const TEST_HOST = "localhost";
export const TEST_PORT = 4444;

export function req(addr: string, init?: RequestInit) {
	return new Request(reqPath(addr), init);
}

export function reqPath(addr: string): string {
	return `http://${TEST_HOST}:${TEST_PORT}${joinPathSegments($registry.prefix, addr)}`;
}

export async function parseBody<T>(r: Request | Res | Response): Promise<T> {
	const body = await $registry.bodyParser.parse(r);
	return await $registry.schemaParser.parse<T>("body", body);
}

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

	const s = router ? new ServerWithRouter({ ...serverOpts, router }) : new Server(serverOpts);

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

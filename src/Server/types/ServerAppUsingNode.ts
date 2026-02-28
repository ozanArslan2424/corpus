import type http from "node:http";

export type ServerAppUsingNode = http.Server<
	typeof http.IncomingMessage,
	typeof http.ServerResponse
>;

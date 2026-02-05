import { CoreumServer as _CoreumServer } from "@/internal/CoreumServer/CoreumServer";

/**
 * Server is the entrypoint to the app.
 * It takes the routes, controllers, middlewares, and HTML bundles for static pages.
 * A router instance must be passed to a {@link CoreumServer} to start listening.
 * At least one controller is required for middlewares to work.
 * You can pass a {@link DBClientInterface} instance to connect and disconnect.
 * You can pass your {@link Cors} object.
 * */

export const CoreumServer = _CoreumServer;
export type CoreumServer = _CoreumServer;
export const Server = _CoreumServer;
export type Server = _CoreumServer;

import { __Coreum_Context } from "@/Context/__Coreum_Context";
import { __Coreum_Cookies } from "@/Cookies/__Coreum_Cookies";
import { __Coreum_Cors } from "@/Cors/__Coreum_Cors";
import { type __Coreum_DBClientInterface } from "@/DBClient/__Coreum_DBClientInterface";
import { __Coreum_CommonHeaders } from "@/CommonHeaders/__Coreum_CommonHeaders";
import { __Coreum_Method } from "@/Method/__Coreum_Method";
import { __Coreum_Error } from "@/Error/__Coreum_Error";
import { __Coreum_Headers } from "@/Headers/__Coreum_Headers";
import { type __Coreum_LoggerInterface } from "@/Logger/__Coreum_Logger";
import { __Coreum_Middleware } from "@/Middleware/__Coreum_Middleware";
import type { __Coreum_InferSchema } from "./parse/__Coreum_InferSchema";
import { __Coreum_Request } from "@/Request/__Coreum_Request";
import { __Coreum_Response } from "@/Response/__Coreum_Response";
import { __Coreum_Route } from "@/Route/__Coreum_Route";
import { __Coreum_setRuntime } from "@/runtime/__Coreum_setRuntime";
import { __Coreum_Server } from "@/Server/__Coreum_Server";
import { __Coreum_Service } from "@/Service/__Coreum_Service";
import { __Coreum_Status } from "@/Status/__Coreum_Status";
import { __Coreum_setGlobalPrefix } from "@/globalPrefix/__Coreum_setGlobalPrefix";
import { __Coreum_Controller } from "@/Controller/__Coreum_Controller";
import { __Coreum_getRuntime } from "@/runtime/__Coreum_getRuntime";
import { __Coreum_getGlobalPrefix } from "@/globalPrefix/__Coreum_getGlobalPrefix";
import { __Coreum_Config } from "@/Config/__Coreum_Config";

export const Config = __Coreum_Config;

/**
 * This function sets the runtime to either "bun" or "node", it defaults to "bun".
 * Some features are only available in "bun".
 * */
export const setRuntime = __Coreum_setRuntime;
export const getRuntime = __Coreum_getRuntime;

export const setGlobalPrefix = __Coreum_setGlobalPrefix;
export const getGlobalPrefix = __Coreum_getGlobalPrefix;

/**
 * Core.Request includes a cookie jar, better headers, and some utilities.
 * */
export const Request = __Coreum_Request;
export type Request = __Coreum_Request;

/**
 * This is NOT the default response. It provides {@link Response.response}
 * getter to access web Response with all mutations applied during the
 * handling of the request, JSON body will be handled and cookies will be
 * applied to response headers.
 * */
export const Response = __Coreum_Response;
export type Response<R = unknown> = __Coreum_Response<R>;

/**
 * Headers is extended to include helpers and intellisense for common
 * header names.
 * */
export const Headers = __Coreum_Headers;
export type Headers = __Coreum_Headers;

/**
 * TODO: Only available in Bun runtime at the moment.
 * Simple cookie map/jar to collect and manipulate cookies. The conversion to
 * Set-Cookie header is handled by {@link Response}
 * */
export const Cookies = __Coreum_Cookies;
export type Cookies = __Coreum_Cookies;

/**
 * The context object used in Route "callback" parameter.
 * Takes 5 generics:
 * D = Data passed through a {@link Middleware}
 * R = The return type
 * B = Request body
 * S = Request URL search params
 * P = Request URL params
 * The types are resolved using Route "schemas" parameter except D
 * which you may want to pass if you have middleware data.
 *
 * Contains:
 * req = {@link Request} instance
 * url = Request URL
 * body = Async function to get the parsed Request body
 * search = Parsed Request URL search params
 * params = Parsed Request URL params
 * status = To set the Response status
 * statusText = To set the Response statusText
 * headers = To set the Response {@link Headers}
 * cookies = To set the Response {@link Cookies}
 * */
export const Context = __Coreum_Context;
export type Context<
	D = void,
	R extends unknown = unknown,
	B extends unknown = unknown,
	S extends unknown = unknown,
	P extends unknown = unknown,
> = __Coreum_Context<D, R, B, S, P>;

export const Service = __Coreum_Service;
export type Service = __Coreum_Service;

export const Error = __Coreum_Error;
export type Error = __Coreum_Error;

/**
 * Simple middleware that runs before the Route "callback" parameters.
 * can return data for {@link Context.data}
 * */
export const Middleware = __Coreum_Middleware;
export type Middleware<D = void> = __Coreum_Middleware<D>;

/**
 * Simple cors helper object to set cors headers
 * */
export const Cors = __Coreum_Cors;
export type Cors = __Coreum_Cors;

/**
 * The object to define an endpoint. Can be instantiated with "new" or inside a controller
 * with {@link Controller.route}. The callback recieves the {@link Context} and can
 * return {@link Response} or object or nothing.
 * */
export const Route = __Coreum_Route;
export type Route<
	D = undefined,
	R extends unknown = unknown,
	B extends unknown = unknown,
	S extends unknown = unknown,
	P extends unknown = unknown,
> = __Coreum_Route<D, R, B, S, P>;

export const Controller = __Coreum_Controller;
export type Controller = __Coreum_Controller;

/**
 * Server is the entrypoint to the app.
 * It takes the routes, controllers, middlewares, and HTML bundles for static pages.
 * A router instance must be passed to a {@link Server} to start listening.
 * At least one controller is required for middlewares to work.
 * You can pass a {@link DBClientInterface} instance to connect and disconnect.
 * You can pass your {@link Cors} object.
 * */
export const Server = __Coreum_Server;
export type Server = __Coreum_Server;

/**
 * Just some common headers.
 * */
export const CommonHeaders = __Coreum_CommonHeaders;
export type CommonHeaders = __Coreum_CommonHeaders;

/**
 * Commonly used HTTP status codes.
 * */
export const Status = __Coreum_Status;
export type Status = __Coreum_Status;

/**
 * Commonly used HTTP verbs.
 * */
export const Method = __Coreum_Method;
export type Method = __Coreum_Method;

export interface DBClientInterface extends __Coreum_DBClientInterface {}
export interface LoggerInterface extends __Coreum_LoggerInterface {}
export type InferSchema<T> = __Coreum_InferSchema<T>;

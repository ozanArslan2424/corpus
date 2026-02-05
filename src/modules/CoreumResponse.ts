import { CoreumResponse as _CoreumResponse } from "@/internal/CoreumResponse/CoreumResponse";

/**
 * This is NOT the default response. It provides {@link Response.response}
 * getter to access web Response with all mutations applied during the
 * handling of the request, JSON body will be handled and cookies will be
 * applied to response headers.
 * */

export const CoreumResponse = _CoreumResponse;
export type CoreumResponse<R = unknown> = _CoreumResponse<R>;
export const Response = _CoreumResponse;
export type Response<R = unknown> = _CoreumResponse<R>;

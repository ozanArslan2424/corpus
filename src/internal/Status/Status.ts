import type { ValueOf } from "@/utils/ValueOf";

export const Status = {
	// --- 1xx Informational ---
	/** Continue: Request received, please continue */
	CONTINUE: 100,
	/** Switching Protocols: Protocol change request approved */
	SWITCHING_PROTOCOLS: 101,
	/** Processing (WebDAV) */
	PROCESSING: 102,
	/** Early Hints */
	EARLY_HINTS: 103,

	// --- 2xx Success ---
	/** OK: Request succeeded */
	OK: 200,
	/** Created: Resource created */
	CREATED: 201,
	/** Accepted: Request accepted but not completed */
	ACCEPTED: 202,
	/** Non-Authoritative Information */
	NON_AUTHORITATIVE_INFORMATION: 203,
	/** No Content: Request succeeded, no body returned */
	NO_CONTENT: 204,
	/** Reset Content: Clear form or view */
	RESET_CONTENT: 205,
	/** Partial Content: Partial GET successful (e.g. range requests) */
	PARTIAL_CONTENT: 206,
	/** Multi-Status (WebDAV) */
	MULTI_STATUS: 207,
	/** Already Reported (WebDAV) */
	ALREADY_REPORTED: 208,
	/** IM Used (HTTP Delta encoding) */
	IM_USED: 226,

	// --- 3xx Redirection ---
	/** Multiple Choices */
	MULTIPLE_CHOICES: 300,
	/** Moved Permanently: Resource moved to a new URL */
	MOVED_PERMANENTLY: 301,
	/** Found: Resource temporarily under different URI */
	FOUND: 302,
	/** See Other: Redirect to another URI using GET */
	SEE_OTHER: 303,
	/** Not Modified: Cached version is still valid */
	NOT_MODIFIED: 304,
	/** Use Proxy: Deprecated */
	USE_PROXY: 305,
	/** Temporary Redirect: Resource temporarily at another URI */
	TEMPORARY_REDIRECT: 307,
	/** Permanent Redirect: Resource permanently at another URI */
	PERMANENT_REDIRECT: 308,

	// --- 4xx Client Errors ---
	/** Bad Request: Malformed request */
	BAD_REQUEST: 400,
	/** Unauthorized: Missing or invalid auth credentials */
	UNAUTHORIZED: 401,
	/** Payment Required: Reserved for future use */
	PAYMENT_REQUIRED: 402,
	/** Forbidden: Authenticated but no permission */
	FORBIDDEN: 403,
	/** Not Found: Resource does not exist */
	NOT_FOUND: 404,
	/** Method Not Allowed: HTTP method not allowed */
	METHOD_NOT_ALLOWED: 405,
	/** Not Acceptable: Response not acceptable by client */
	NOT_ACCEPTABLE: 406,
	/** Proxy Authentication Required */
	PROXY_AUTHENTICATION_REQUIRED: 407,
	/** Request Timeout: Server timeout waiting for client */
	REQUEST_TIMEOUT: 408,
	/** Conflict: Request conflict (e.g. duplicate resource) */
	CONFLICT: 409,
	/** Gone: Resource is no longer available */
	GONE: 410,
	/** Length Required: Missing Content-Length header */
	LENGTH_REQUIRED: 411,
	/** Precondition Failed */
	PRECONDITION_FAILED: 412,
	/** Payload Too Large */
	PAYLOAD_TOO_LARGE: 413,
	/** URI Too Long */
	URI_TOO_LONG: 414,
	/** Unsupported Media Type */
	UNSUPPORTED_MEDIA_TYPE: 415,
	/** Range Not Satisfiable */
	RANGE_NOT_SATISFIABLE: 416,
	/** Expectation Failed */
	EXPECTATION_FAILED: 417,
	/** I'm a teapot: Joke response for coffee machines */
	IM_A_TEAPOT: 418,
	/** Misdirected Request: Sent to the wrong server */
	MISDIRECTED_REQUEST: 421,
	/** Unprocessable Entity (WebDAV) */
	UNPROCESSABLE_ENTITY: 422,
	/** Locked (WebDAV) */
	LOCKED: 423,
	/** Failed Dependency (WebDAV) */
	FAILED_DEPENDENCY: 424,
	/** Too Early: Request might be replayed */
	TOO_EARLY: 425,
	/** Upgrade Required */
	UPGRADE_REQUIRED: 426,
	/** Precondition Required */
	PRECONDITION_REQUIRED: 428,
	/** Too Many Requests: Rate limiting */
	TOO_MANY_REQUESTS: 429,
	/** Request Header Fields Too Large */
	REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
	/** Unavailable For Legal Reasons */
	UNAVAILABLE_FOR_LEGAL_REASONS: 451,

	// --- 5xx Server Errors ---
	/** Internal Server Error: Unhandled server error */
	INTERNAL_SERVER_ERROR: 500,
	/** Not Implemented: Endpoint/method not implemented */
	NOT_IMPLEMENTED: 501,
	/** Bad Gateway: Invalid response from upstream server */
	BAD_GATEWAY: 502,
	/** Service Unavailable: Server temporarily overloaded/down */
	SERVICE_UNAVAILABLE: 503,
	/** Gateway Timeout: No response from upstream server */
	GATEWAY_TIMEOUT: 504,
	/** HTTP Version Not Supported */
	HTTP_VERSION_NOT_SUPPORTED: 505,
	/** Variant Also Negotiates */
	VARIANT_ALSO_NEGOTIATES: 506,
	/** Insufficient Storage (WebDAV) */
	INSUFFICIENT_STORAGE: 507,
	/** Loop Detected (WebDAV) */
	LOOP_DETECTED: 508,
	/** Not Extended */
	NOT_EXTENDED: 510,
	/** Network Authentication Required */
	NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

export type Status = ValueOf<typeof Status> | number;

import type { ValueOf } from "@/utils/ValueOf";

export const CommonHeaders = {
	/** Controls caching mechanisms for requests and responses */
	CacheControl: "Cache-Control",
	/** Specifies the media type of the resource or data */
	ContentType: "Content-Type",
	/** Indicates the size of the entity-body in bytes */
	ContentLength: "Content-Length",
	/** Specifies the character encodings that are acceptable */
	AcceptEncoding: "Accept-Encoding",
	/** Informs the server about the types of data that can be sent back */
	Accept: "Accept",
	/** Contains the credentials to authenticate with the server */
	Authorization: "Authorization",
	/** The user agent string of the client software */
	UserAgent: "User-Agent",
	/** The domain name of the server and port number */
	Host: "Host",
	/** The address of the previous web page from which the current request originated */
	Referer: "Referer",
	/** Indicates whether the connection should be kept alive */
	Connection: "Connection",
	/** Used to specify directives that must be obeyed by caching mechanisms */
	Pragma: "Pragma",
	/** The date and time at which the message was sent */
	Date: "Date",
	/** Makes the request conditional based on the ETag of the resource */
	IfNoneMatch: "If-None-Match",
	/** Makes the request conditional based on the last modification date */
	IfModifiedSince: "If-Modified-Since",
	/** An identifier for a specific version of a resource */
	ETag: "ETag",
	/** The date and time after which the response is considered stale */
	Expires: "Expires",
	/** The last modification date of the resource */
	LastModified: "Last-Modified",
	/** Indicates the URL to redirect a page to */
	Location: "Location",
	/** Defines the authentication method that should be used */
	WWWAuthenticate: "WWW-Authenticate",
	/** Allows the server to indicate its origin */
	AccessControlAllowOrigin: "Access-Control-Allow-Origin",
	/** Determines how long the results of a preflight request can be cached */
	AccessControlMaxAge: "Access-Control-Max-Age",
	/** Indicates whether the response can be shared with resources with credentials */
	AccessControlAllowCredentials: "Access-Control-Allow-Credentials",
	AccessControlRequestMethod: "Access-Control-Request-Method",
	SetCookie: "Set-Cookie",
} as const;

export type CommonHeaders = ValueOf<typeof CommonHeaders>;

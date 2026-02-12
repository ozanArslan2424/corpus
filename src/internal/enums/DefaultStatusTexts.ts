import { Status } from "@/internal/enums/Status";

export const DefaultStatusTexts = {
	[Status.OK]: "OK",
	[Status.CREATED]: "Created",
	[Status.NO_CONTENT]: "No Content",
	[Status.MOVED_PERMANENTLY]: "Moved Permanently",
	[Status.FOUND]: "Found",
	[Status.SEE_OTHER]: "See Other",
	[Status.TEMPORARY_REDIRECT]: "Temporary Redirect",
	[Status.PERMANENT_REDIRECT]: "Permanent Redirect",
	[Status.BAD_REQUEST]: "Bad Request",
	[Status.UNAUTHORIZED]: "Unauthorized",
	[Status.FORBIDDEN]: "Forbidden",
	[Status.NOT_FOUND]: "Not Found",
	[Status.INTERNAL_SERVER_ERROR]: "Internal Server Error",
};

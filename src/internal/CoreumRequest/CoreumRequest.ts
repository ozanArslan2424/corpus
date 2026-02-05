import { CommonHeaders } from "@/internal/CommonHeaders/CommonHeaders";
import { Method } from "@/internal/Method/Method";
import { getValues } from "@/utils/getValues";
import { textSplit } from "@/utils/textSplit";
import { isFoundIn } from "@/utils/isFoundIn";
import { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import type { CoreumRequestInfo } from "@/internal/CoreumRequest/CoreumRequestInfo";
import type { CoreumRequestInit } from "@/internal/CoreumRequest/CoreumRequestInit";

export class CoreumRequest extends Request {
	readonly cookies = new CoreumCookies();

	constructor(
		url: CoreumRequestInfo,
		readonly init?: CoreumRequestInit,
	) {
		const headers = new CoreumHeaders(init?.headers);
		delete init?.headers;
		super(url, { ...init, headers });
		this.parseCookies();
	}

	get isMethodNotAllowed() {
		return !getValues(Method).includes(this.method.toUpperCase() as Method);
	}

	get isPreflight() {
		const accessControlRequestMethodHeader =
			this.headers.get(CommonHeaders.AccessControlRequestMethod) ||
			this.headers.get(CommonHeaders.AccessControlRequestMethod.toLowerCase());
		return this.method === Method.OPTIONS && accessControlRequestMethodHeader;
	}

	get contentType() {
		const contentTypeHeader =
			this.headers.get(CommonHeaders.ContentType) ||
			this.headers.get(CommonHeaders.ContentType.toLowerCase()) ||
			"";

		if (
			!isFoundIn(this.method.toUpperCase(), [
				Method.POST,
				Method.PUT,
				Method.PATCH,
				Method.DELETE,
			])
		) {
			return "no-body-allowed";
		}

		if (contentTypeHeader.includes("application/json")) {
			return "json";
		} else if (
			contentTypeHeader.includes("application/x-www-form-urlencoded")
		) {
			return "form-urlencoded";
		} else if (contentTypeHeader.includes("multipart/form-data")) {
			return "form-data";
		} else if (contentTypeHeader.includes("text/plain")) {
			return "text";
		} else if (contentTypeHeader.includes("application/xml")) {
			return "xml";
		} else if (contentTypeHeader.includes("text/xml")) {
			return "xml";
		} else if (contentTypeHeader.includes("application/octet-stream")) {
			return "binary";
		} else if (contentTypeHeader.includes("application/pdf")) {
			return "pdf";
		} else if (contentTypeHeader.includes("image/")) {
			return "image";
		} else if (contentTypeHeader.includes("audio/")) {
			return "audio";
		} else if (contentTypeHeader.includes("video/")) {
			return "video";
		}

		return "unknown";
	}

	/**
	 * Gets cookie header and collects cookies for the jar
	 * */
	private parseCookies() {
		const cookieHeader = this.headers.get("cookie");
		if (cookieHeader) {
			const pairs = textSplit(";", cookieHeader);
			for (const pair of pairs) {
				const [name, value] = textSplit("=", pair);
				if (!name || !value) continue;
				this.cookies.set({ name, value });
			}
		}
	}
}

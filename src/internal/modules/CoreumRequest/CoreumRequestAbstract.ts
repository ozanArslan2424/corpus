import { CommonHeaders } from "@/internal/enums/CommonHeaders";
import { Method } from "@/internal/enums/Method";
import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";
import { Cookies } from "@/internal/modules/Cookies/Cookies";
import { CoreumHeaders } from "@/internal/modules/CoreumHeaders/CoreumHeaders";
import type { CoreumRequestInfo } from "@/internal/types/CoreumRequestInfo";
import type { CoreumRequestInit } from "@/internal/types/CoreumRequestInit";
import { isFoundIn } from "@/internal/utils/isFoundIn";
import { textSplit } from "@/internal/utils/textSplit";
import type { CookiesInterface } from "@/internal/modules/Cookies/CookiesInterface";
import type { CoreumHeadersInterface } from "@/internal/modules/CoreumHeaders/CoreumHeadersInterface";

export abstract class CoreumRequestAbstract
	extends Request
	implements CoreumRequestInterface
{
	constructor(
		readonly input: CoreumRequestInfo,
		readonly init?: CoreumRequestInit,
	) {
		super(input, init);
	}

	override get headers(): CoreumHeadersInterface {
		if (this.input instanceof Request) {
			return new CoreumHeaders(this.input.headers);
		} else if (this.init?.headers !== undefined) {
			return new CoreumHeaders(this.init.headers);
		} else {
			return new CoreumHeaders();
		}
	}

	/** Gets cookie header and collects cookies for the jar */
	get cookies(): CookiesInterface {
		const jar = new Cookies();

		const cookieHeader = this.headers.get(CommonHeaders.Cookie);

		if (cookieHeader) {
			const pairs = textSplit(";", cookieHeader);

			for (const pair of pairs) {
				const [name, value] = textSplit("=", pair);
				if (!name || !value) continue;
				jar.set({ name, value });
			}
		}

		return jar;
	}

	get isPreflight(): boolean {
		const accessControlRequestMethodHeader = this.headers.has(
			CommonHeaders.AccessControlRequestMethod,
		);
		return this.method === Method.OPTIONS && accessControlRequestMethodHeader;
	}

	get normalizedContentType(): string {
		const contentTypeHeader = this.headers.get(CommonHeaders.ContentType) || "";

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
}

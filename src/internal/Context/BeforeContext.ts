import { CoreumCookies } from "@/internal/Cookies/CoreumCookies";
import { CoreumHeaders } from "@/internal/CoreumHeaders/CoreumHeaders";
import { CoreumRequest } from "@/internal/CoreumRequest/CoreumRequest";

export class BeforeContext<D = void> {
	req: CoreumRequest;
	url: URL;
	headers: CoreumHeaders;
	cookies: CoreumCookies;

	constructor(
		private readonly request: Request,
		readonly path: string,
		public data?: D,
	) {
		this.req = new CoreumRequest(this.request);
		this.url = new URL(this.req.url);
		this.headers = new CoreumHeaders(this.req.headers);
		this.cookies = new CoreumCookies();
	}
}

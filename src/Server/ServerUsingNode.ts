import { Method } from "@/Request/enums/Method";
import { ServerAbstract } from "@/Server/ServerAbstract";
import type { ServeOptions } from "@/Server/types/ServeOptions";
import type { ServerAppUsingNode } from "@/Server/types/ServerAppUsingNode";
import http from "node:http";

export class ServerUsingNode extends ServerAbstract {
	private app: ServerAppUsingNode | undefined;

	serve(options: ServeOptions): void {
		const app = this.createApp(options);
		this.app = app;
		app.listen(options.port, options.hostname);
	}

	async close(): Promise<void> {
		this.app?.close();
		this.app?.closeAllConnections();
		this.app?.closeIdleConnections();
	}

	private createApp(options: ServeOptions): ServerAppUsingNode {
		return http.createServer(async (incomingMessage, serverResponse) => {
			const body = await this.getBody(incomingMessage);
			const url = this.getUrl(incomingMessage);
			const method = this.getMethod(incomingMessage);
			const headers = this.getHeaders(incomingMessage);
			const request = this.getRequest(url, method, headers, body);
			const response = await options.fetch(request);
			const data = await this.getData(response);

			serverResponse.statusCode = response.status;
			serverResponse.setHeaders(response.headers);
			serverResponse.end(Buffer.from(data));
		});
	}

	private async getBody(incomingMessage: http.IncomingMessage) {
		let body: Buffer<ArrayBuffer> | undefined = undefined;

		const chunks: Uint8Array[] = [];
		for await (const chunk of incomingMessage) {
			chunks.push(chunk);
		}
		if (chunks.length > 0) {
			body = Buffer.concat(chunks);
		}

		return body;
	}

	private getUrl(incomingMessage: http.IncomingMessage) {
		// Check for proxy headers first (common in production)
		const forwardedProtocol = incomingMessage.headers["x-forwarded-proto"];
		const protocolFromForwarded = Array.isArray(forwardedProtocol)
			? forwardedProtocol[0]
			: forwardedProtocol;

		// Check direct TLS connection
		const socket = incomingMessage.socket as { encrypted?: boolean };
		const isEncrypted = socket.encrypted;

		// Determine protocol
		let protocol: string;
		if (protocolFromForwarded) {
			protocol = `${protocolFromForwarded}://`;
		} else if (isEncrypted) {
			protocol = "https://";
		} else {
			protocol = "http://";
		}

		return `${protocol}${incomingMessage.headers.host}${incomingMessage.url}`;
	}

	private getMethod(incomingMessage: http.IncomingMessage) {
		return incomingMessage.method?.toUpperCase() ?? Method.GET;
	}

	private getHeaders(incomingMessage: http.IncomingMessage) {
		const headers = new Headers();

		for (const [key, value] of Object.entries(incomingMessage.headers)) {
			if (Array.isArray(value)) {
				for (const v of value) headers.append(key, v);
			} else if (value != null && typeof value === "string") {
				headers.append(key, value);
			}
		}

		return headers;
	}

	private getRequest(
		url: string,
		method: string,
		headers: Headers,
		body: Buffer<ArrayBuffer> | undefined,
	) {
		if (method !== Method.GET) {
			return new Request(url, { method, headers, body });
		} else {
			return new Request(url, { method, headers });
		}
	}

	private async getData(response: Response) {
		return await response.arrayBuffer();
	}
}

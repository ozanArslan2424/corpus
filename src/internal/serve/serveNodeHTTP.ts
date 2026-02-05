import { Method } from "@/internal/Method/Method";
import type { ServeOptions } from "@/internal/serve/ServeOptions";
import http from "node:http";

export function serveNodeHTTP(options: ServeOptions) {
	if (options.staticPages) {
		console.error("Static pages aren't supported in node.");
	}

	async function getBody(incomingMessage: http.IncomingMessage) {
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

	function getUrl(incomingMessage: http.IncomingMessage) {
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

	function getMethod(incomingMessage: http.IncomingMessage) {
		return incomingMessage.method?.toUpperCase() ?? Method.GET;
	}

	function getHeaders(incomingMessage: http.IncomingMessage) {
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

	function getRequest(
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

	async function getResponse(request: Request) {
		return await options.fetch(request);
	}

	async function getData(response: Response) {
		return await response.arrayBuffer();
	}

	http
		.createServer(async (incomingMessage, serverResponse) => {
			const body = await getBody(incomingMessage);
			const url = getUrl(incomingMessage);
			const method = getMethod(incomingMessage);
			const headers = getHeaders(incomingMessage);
			const request = getRequest(url, method, headers, body);
			const response = await getResponse(request);
			const data = await getData(response);

			serverResponse.statusCode = response.status;
			serverResponse.setHeaders(response.headers);
			serverResponse.end(Buffer.from(data));
		})
		.listen(options.port, options.hostname);
}

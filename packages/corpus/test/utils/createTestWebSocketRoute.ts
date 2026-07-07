import type { Logger } from "@/utils/logger";

import { TC, type WebSocketRouteDefinition } from "../_modules";

export function createTestWebSocketRoute(log: Logger, withAbstract: boolean) {
	if (withAbstract) {
		class WSR extends TC.WebSocketRouteAbstract {
			constructor() {
				super();
				this.register();
			}

			endpoint: string = "/ws";

			onOpen?: WebSocketRouteDefinition["onOpen"] | undefined = (ws) => {
				log.info(`[ws] New connection opened — remoteAddress: ${ws.remoteAddress}`);
				ws.send(
					JSON.stringify({
						event: "connected",
						data: { remoteAddress: ws.remoteAddress },
					}),
				);
				log.debug(`[ws] Sent connected greeting to ${ws.remoteAddress}`);
			};

			onClose?: WebSocketRouteDefinition["onClose"] | undefined = (_ws, code, reason) => {
				log.info(`[ws] Connection closed — code=${code} reason=${reason ?? "no reason provided"}`);
			};

			onMessage: WebSocketRouteDefinition["onMessage"] = (ws, message) => {
				// oxlint-disable-next-line typescript/restrict-template-expressions
				log.debug(`[ws] Received message: ${message}`);
				const msg = JSON.parse(message as string) as {
					event: string;
					topic?: string;
					data?: unknown;
				};

				switch (msg.event) {
					case "subscribe": {
						log.info(`[ws] Client subscribing to topic: ${msg.topic}`);
						ws.subscribe(msg.topic!);
						ws.send(JSON.stringify({ event: "subscribed", topic: msg.topic }));
						log.debug(`[ws] Sent subscribed confirmation for topic: ${msg.topic}`);
						break;
					}
					case "unsubscribe": {
						log.info(`[ws] Client unsubscribing from topic: ${msg.topic}`);
						ws.unsubscribe(msg.topic!);
						ws.send(JSON.stringify({ event: "unsubscribed", topic: msg.topic }));
						log.debug(`[ws] Sent unsubscribed confirmation for topic: ${msg.topic}`);
						break;
					}
					case "publish": {
						log.info(`[ws] Client publishing to topic: ${msg.topic}`, {
							data: msg.data,
						});
						const sent = ws.publish(
							msg.topic!,
							JSON.stringify({
								event: "message",
								topic: msg.topic,
								data: msg.data,
							}),
						);
						ws.send(
							JSON.stringify({
								event: "published",
								topic: msg.topic,
								bytes: sent,
							}),
						);
						log.info(`[ws] Published to ${msg.topic} — ${sent} bytes sent`);
						break;
					}
					case "ping": {
						log.debug(`[ws] Received ping, sending pong`);
						ws.send(JSON.stringify({ event: "pong", data: msg.data }));
						break;
					}
					case "subscriptions": {
						log.debug(`[ws] Client requesting subscriptions`);
						ws.send(
							JSON.stringify({
								event: "subscriptions",
								data: ws.subscriptions,
							}),
						);
						log.debug(`[ws] Sent subscriptions: ${JSON.stringify(ws.subscriptions)}`);
						break;
					}
					default: {
						log.warn(`[ws] Unknown event received: ${msg.event}`);
						ws.send(
							JSON.stringify({
								event: "error",
								data: `unknown event: ${msg.event}`,
							}),
						);
					}
				}
			};
		}

		new WSR();
	} else {
		new TC.WebSocketRoute("/ws", {
			onOpen: (ws) => {
				log.info(`[ws] New connection opened — remoteAddress: ${ws.remoteAddress}`);
				ws.send(
					JSON.stringify({
						event: "connected",
						data: { remoteAddress: ws.remoteAddress },
					}),
				);
				log.debug(`[ws] Sent connected greeting to ${ws.remoteAddress}`);
			},

			onClose: (_ws, code, reason) => {
				log.info(`[ws] Connection closed — code=${code} reason=${reason ?? "no reason provided"}`);
			},

			onMessage: (ws, message) => {
				// oxlint-disable-next-line typescript/restrict-template-expressions
				log.debug(`[ws] Received message: ${message}`);
				const msg = JSON.parse(message as string) as {
					event: string;
					topic?: string;
					data?: unknown;
				};

				switch (msg.event) {
					case "subscribe": {
						log.info(`[ws] Client subscribing to topic: ${msg.topic}`);
						ws.subscribe(msg.topic!);
						ws.send(JSON.stringify({ event: "subscribed", topic: msg.topic }));
						log.debug(`[ws] Sent subscribed confirmation for topic: ${msg.topic}`);
						break;
					}
					case "unsubscribe": {
						log.info(`[ws] Client unsubscribing from topic: ${msg.topic}`);
						ws.unsubscribe(msg.topic!);
						ws.send(JSON.stringify({ event: "unsubscribed", topic: msg.topic }));
						log.debug(`[ws] Sent unsubscribed confirmation for topic: ${msg.topic}`);
						break;
					}
					case "publish": {
						log.info(`[ws] Client publishing to topic: ${msg.topic}`, {
							data: msg.data,
						});
						const sent = ws.publish(
							msg.topic!,
							JSON.stringify({
								event: "message",
								topic: msg.topic,
								data: msg.data,
							}),
						);
						ws.send(
							JSON.stringify({
								event: "published",
								topic: msg.topic,
								bytes: sent,
							}),
						);
						log.info(`[ws] Published to ${msg.topic} — ${sent} bytes sent`);
						break;
					}
					case "ping": {
						log.debug(`[ws] Received ping, sending pong`);
						ws.send(JSON.stringify({ event: "pong", data: msg.data }));
						break;
					}
					case "subscriptions": {
						log.debug(`[ws] Client requesting subscriptions`);
						ws.send(
							JSON.stringify({
								event: "subscriptions",
								data: ws.subscriptions,
							}),
						);
						log.debug(`[ws] Sent subscriptions: ${JSON.stringify(ws.subscriptions)}`);
						break;
					}
					default: {
						log.warn(`[ws] Unknown event received: ${msg.event}`);
						ws.send(
							JSON.stringify({
								event: "error",
								data: `unknown event: ${msg.event}`,
							}),
						);
					}
				}
			},
		});
	}
}

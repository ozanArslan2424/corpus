import { TestHelper, type Logger } from "@ozanarslan/utils";

import { Server } from "@/C/Server/Server";
import { WebSocketRoute } from "@/C/WebSocketRoute/WebSocketRoute";
import { WebSocketRouteAbstract } from "@/C/WebSocketRoute/WebSocketRoute.abstract";
import type { WebSocketRouteDefinition } from "@/C/WebSocketRoute/WebSocketRoute.types";

const PORT = 9876;
const BASE_URL = `ws://localhost:${PORT}`;
const SILENT = process.argv[2] === "-s";
const T = new TestHelper(SILENT);
const server = new Server({ port: PORT });

export function createTestWebSocketRoute(log: Logger, withAbstract: boolean) {
	if (withAbstract) {
		class WSR extends WebSocketRouteAbstract {
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
		new WebSocketRoute("/ws", {
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

async function run(withAbstract: boolean) {
	T.log.info("Setting up WebSocket route...");
	createTestWebSocketRoute(T.log, withAbstract);
	await server.listen();

	const WS_URL = `${BASE_URL}/ws`;
	T.log.info(`WebSocket URL: ${WS_URL}`);

	// ── helpers ──────────────────────────────────────────────────────────────────

	async function send(ws: WebSocket, payload: any) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		const message = T.stringify(payload);
		T.log.debug(`Sending message: ${message}`);
		ws.send(message);
	}

	function close(ws: WebSocket): Promise<void> {
		T.log.debug(`Closing WebSocket connection...`);
		return new Promise((resolve) => {
			ws.onclose = () => {
				T.log.success(`WebSocket closed successfully`);
				resolve();
			};
			ws.close();
		});
	}

	function makeClient(label: string): Promise<{ ws: WebSocket; next: () => Promise<any> }> {
		T.log.info(`Creating client: ${label}`);
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(WS_URL);
			const queue: any[] = [];
			const waiters: ((v: any) => void)[] = [];

			ws.onmessage = (e) => {
				const msg = JSON.parse(e.data as string);
				T.log.info(`[${label}] << Received:`, msg);
				const waiter = waiters.shift();
				if (waiter) waiter(msg);
				else queue.push(msg);
			};

			const next = (): Promise<any> => {
				if (queue.length) return Promise.resolve(queue.shift());
				return new Promise((res) => waiters.push(res));
			};

			ws.onopen = () => {
				T.log.success(`[${label}] Connected to WebSocket server`);
				resolve({ ws, next });
			};
			ws.onerror = (error) => {
				T.log.error(`[${label}] Connection error:`, error);
				reject(new Error(`[${label}] connection error`));
			};
		});
	}

	// ── test ─────────────────────────────────────────────────────────────────────

	async function runTests() {
		// Three clients
		T.log.info("Creating three test clients...");
		const { ws: alice, next: aliceNext } = await makeClient("alice");
		const { ws: bob, next: bobNext } = await makeClient("bob");
		const { ws: carol, next: carolNext } = await makeClient("carol");
		T.log.success("All three clients connected");

		// Consume the "connected" greeting from each
		T.log.info("Consuming connected greetings...");
		const aliceGreeting = await aliceNext();
		const bobGreeting = await bobNext();
		const carolGreeting = await carolNext();

		T.log.debug("[alice] greeting:", aliceGreeting);
		T.log.debug("[bob]   greeting:", bobGreeting);
		T.log.debug("[carol] greeting:", carolGreeting);

		T.expect("alice greeting event", aliceGreeting).toHaveProperty("event", "connected");
		T.expect("bob greeting event", bobGreeting).toHaveProperty("event", "connected");
		T.expect("carol greeting event", carolGreeting).toHaveProperty("event", "connected");
		T.log.success("All clients received connected greetings");

		// ── ping / pong ───────────────────────────────────────────────────────────
		T.log.info("Testing ping/pong...");
		await send(alice, { event: "ping", data: { ts: Date.now() } });
		const pong = await aliceNext();
		T.log.info("[alice] pong received:", pong);
		T.expect("pong event", pong).toHaveProperty("event", "pong");
		T.expect("pong has data", pong).toHaveProperty("data");
		T.log.success("Ping/pong successful");

		// ── subscribe alice + bob to "news", carol to "sports" ───────────────────
		T.log.info("Testing subscriptions...");
		await send(alice, { event: "subscribe", topic: "news" });
		await send(bob, { event: "subscribe", topic: "news" });
		await send(carol, { event: "subscribe", topic: "sports" });

		const aliceSub = await aliceNext();
		const bobSub = await bobNext();
		const carolSub = await carolNext();

		T.log.info("[alice] subscribed:", aliceSub);
		T.log.info("[bob]   subscribed:", bobSub);
		T.log.info("[carol] subscribed:", carolSub);

		T.expect("alice sub event", aliceSub).toHaveProperty("event", "subscribed");
		T.expect("alice sub topic", aliceSub).toHaveProperty("topic", "news");
		T.expect("bob sub event", bobSub).toHaveProperty("event", "subscribed");
		T.expect("bob sub topic", bobSub).toHaveProperty("topic", "news");
		T.expect("carol sub event", carolSub).toHaveProperty("event", "subscribed");
		T.expect("carol sub topic", carolSub).toHaveProperty("topic", "sports");
		T.log.success("Initial subscriptions successful");

		// ── carol also subscribes to "news" ───────────────────────────────────────
		T.log.info("Carol subscribing to news...");
		await send(carol, { event: "subscribe", topic: "news" });
		const carolSubNews = await carolNext();
		T.log.info("[carol] subscribed to news:", carolSubNews);
		T.expect("carol sub news event", carolSubNews).toHaveProperty("event", "subscribed");
		T.expect("carol sub news topic", carolSubNews).toHaveProperty("topic", "news");
		T.log.success("Carol subscribed to news");

		// ── query subscriptions ───────────────────────────────────────────────────
		T.log.info("Querying Carol's subscriptions...");
		await send(carol, { event: "subscriptions" });
		const carolSubs = await carolNext();
		T.log.info("[carol] active subscriptions:", carolSubs);
		T.expect("carol subs event", carolSubs).toHaveProperty("event", "subscriptions");
		T.expect("carol subs data", carolSubs.data).toEqual(["sports", "news"]);
		T.expect("carol subs length", carolSubs.data?.length).toBe(2);
		T.log.success("Subscription query successful");

		// ── alice publishes to "news" (bob + carol receive, alice gets ack) ───────
		T.log.info("Testing publish to news topic...");
		const bobReceives = bobNext();
		const carolReceives = carolNext();

		await send(alice, {
			event: "publish",
			topic: "news",
			data: { headline: "corpus ships" },
		});

		const aliceAck = await aliceNext();
		const bobNews = await bobReceives;
		const carolNews = await carolReceives;

		T.log.info("[alice] publish ack:", aliceAck);
		T.log.info("[bob]   received news:", bobNews);
		T.log.info("[carol] received news:", carolNews);

		T.expect("alice ack event", aliceAck).toHaveProperty("event", "published");
		T.expect("alice ack topic", aliceAck).toHaveProperty("topic", "news");
		T.expect("alice ack bytes", aliceAck.bytes).toBeGreaterThan(0);
		T.expect("bob news event", bobNews).toHaveProperty("event", "message");
		T.expect("bob news topic", bobNews).toHaveProperty("topic", "news");
		T.expect("bob news headline", bobNews.data?.headline).toBe("corpus ships");
		T.expect("carol news event", carolNews).toHaveProperty("event", "message");
		T.expect("carol news topic", carolNews).toHaveProperty("topic", "news");
		T.expect("carol news headline", carolNews.data?.headline).toBe("corpus ships");
		T.log.success("Both Bob and Carol received the news message");

		// ── carol publishes to "sports" (only carol is subscribed, she doesn't receive her own) ─
		T.log.info("Testing publish to sports topic...");
		await send(carol, {
			event: "publish",
			topic: "sports",
			data: { score: "2-1" },
		});
		const carolSportsAck = await carolNext();
		T.log.info("[carol] sports publish ack:", carolSportsAck);
		T.expect("carol sports ack event", carolSportsAck).toHaveProperty("event", "published");
		T.expect("carol sports ack topic", carolSportsAck).toHaveProperty("topic", "sports");
		T.expect("carol sports ack bytes", carolSportsAck.bytes).toBe(0);
		T.log.success("Sports publish successful");

		// ── bob unsubscribes from "news" ──────────────────────────────────────────
		T.log.info("Bob unsubscribing from news...");
		await send(bob, { event: "unsubscribe", topic: "news" });
		const bobUnsub = await bobNext();
		T.log.info("[bob]   unsubscribed:", bobUnsub);
		T.expect("bob unsub event", bobUnsub).toHaveProperty("event", "unsubscribed");
		T.expect("bob unsub topic", bobUnsub).toHaveProperty("topic", "news");
		T.log.success("Bob unsubscribed successfully");

		// ── alice publishes to "news" again — only carol should receive ───────────
		T.log.info("Testing publish after unsubscribe (only Carol should receive)...");
		const carolReceives2 = carolNext();

		await send(alice, {
			event: "publish",
			topic: "news",
			data: { headline: "bob missed this" },
		});
		const aliceAck2 = await aliceNext();
		const carolNews2 = await carolReceives2;

		T.log.info("[alice] publish ack 2:", aliceAck2);
		T.log.info("[carol] received news after bob left:", carolNews2);

		T.expect("alice ack2 event", aliceAck2).toHaveProperty("event", "published");
		T.expect("carol news2 event", carolNews2).toHaveProperty("event", "message");
		T.expect("carol news2 topic", carolNews2).toHaveProperty("topic", "news");
		T.expect("carol news2 headline", carolNews2.data?.headline).toBe("bob missed this");

		T.log.info("Only Carol received the second message (Bob correctly unsubscribed)");

		// ── unknown event ─────────────────────────────────────────────────────────
		T.log.info("Testing unknown event handling...");
		await send(bob, { event: "explode" });
		const err = await bobNext();
		T.log.info("[bob]   error response:", err);
		T.expect("unknown event error", err).toHaveProperty("event", "error");
		T.expect("unknown event message", err.data).toContain("unknown event");
		T.log.success("Unknown event handled correctly");

		// ── clean up ──────────────────────────────────────────────────────────────
		T.log.info("Cleaning up connections...");
		await Promise.all([close(alice), close(bob), close(carol)]);
		T.log.success("All clients closed successfully");
	}

	try {
		await runTests();
	} catch (err) {
		T.log.error("WebSocket Test suite failed:", err);
		T.failures.push(`WebSocket run threw: ${String(err)}`);
		T.failed++;
	}
}

await run(false);
T.logResults("RESULTS FOR WEBSOCKET SIMULATON USING CONSTRUCTOR");
await server.close();

await run(true);
T.logResults("RESULTS FOR WEBSOCKET SIMULATON USING EXTENDED ABSTRACT CLASS");
await server.close();

process.exit(T.failed > 0 ? 1 : 0);

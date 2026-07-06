import * as Bun from "bun";

import type { WebSocketRoute } from "@/WebSocketRoute/WebSocketRoute";

export type ServerApp = Bun.Server<WebSocketRoute>;

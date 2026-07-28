import { C } from "@ozanarslan/corpus";
import Elysia from "elysia";
import express from "express";

import { logFatal } from "@/utils/logger";

const argv = process.argv.slice(2);
const first = argv[0];

console.log(first);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

switch (first) {
	case "elysia": {
		const server = new Elysia();
		server.get("/", () => ({ hello: "world" }));
		server.listen(3000);
		break;
	}

	case "corpus": {
		const server = new C.Server();
		new C.Route("/", () => ({ hello: "world" }));
		server.listen(3000);
		break;
	}

	case "express": {
		const server = express();
		server.get("/", (_, res) => res.send({ hello: "world" }));
		server.listen(3000);
		break;
	}

	default:
		logFatal("corpus or elysia or express");
}

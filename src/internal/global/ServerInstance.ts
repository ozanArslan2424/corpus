import type { ServerInterface } from "@/internal/modules/Server/ServerInterface";

let ServerInstance: ServerInterface;

export function getServerInstance(): ServerInterface {
	if (!ServerInstance) {
		throw new Error(`
Server instance must be created before any instance that can register routes:
- Controller
- Route
`);
	}
	return ServerInstance;
}

export function setServerInstance(instance: ServerInterface): void {
	ServerInstance = instance;
}

import { enumerate, type ValueOf } from "@/utils";

export const RouteVariant = enumerate({
	static: "static",
	file: "file",
	dynamic: "dynamic",
	websocket: "websocket",
	bundle: "bundle",
});

export type RouteVariant = ValueOf<typeof RouteVariant>;

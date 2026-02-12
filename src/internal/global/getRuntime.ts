import { RuntimeOptions } from "@/internal/enums/RuntimeOptions";

export function getRuntime() {
	if (typeof Bun !== "undefined") return RuntimeOptions.bun;
	return RuntimeOptions.node;
}

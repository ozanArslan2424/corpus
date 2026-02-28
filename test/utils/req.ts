import { joinPathSegments } from "@/utils/joinPathSegments";
import { _globalPrefixEnvKey } from "@/Config/constants/_globalPrefixEnvKey";
import { Config } from "@/index";

export const TEST_PORT = 4444;

export function req(addr: string, init?: RequestInit) {
	return new Request(reqPath(addr), init);
}

export function reqPath(addr: string): string {
	return `http://localhost:${TEST_PORT}${joinPathSegments(
		Config.get(_globalPrefixEnvKey, { fallback: "" }),
		addr,
	)}`;
}

import { joinPathSegments } from "@/utils/joinPathSegments";

import { $registryTesting } from "../_modules";

export const TEST_PORT = 4444;

export function req(addr: string, init?: RequestInit) {
	return new Request(reqPath(addr), init);
}

export function reqPath(addr: string): string {
	return `http://localhost:${TEST_PORT}${joinPathSegments($registryTesting.prefix, addr)}`;
}

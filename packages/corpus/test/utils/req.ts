import { joinPathSegments } from "@/Route/joinPathSegments";

import { $registryTesting } from "../_modules";

export const TEST_HOST = "localhost";
export const TEST_PORT = 4444;

export function req(addr: string, init?: RequestInit) {
	return new Request(reqPath(addr), init);
}

export function reqPath(addr: string): string {
	return `http://${TEST_HOST}:${TEST_PORT}${joinPathSegments($registryTesting.prefix, addr)}`;
}

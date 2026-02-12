import { TEST_PORT } from "../constants/TEST_PORT";

export function reqMaker(prefix: string) {
	return (path: string, init?: RequestInit) =>
		new Request(`http://localhost:${TEST_PORT}${prefix}${path}`, init);
}

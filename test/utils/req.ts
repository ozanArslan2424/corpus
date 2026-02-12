import { TEST_PORT } from "test/constants/TEST_PORT";

export const req = (path: string, init?: RequestInit) =>
	new Request(`http://localhost:${TEST_PORT}${path}`, init);

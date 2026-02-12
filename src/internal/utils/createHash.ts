import { createHash as nodeCreateHash } from "crypto";

export function createHash(...strings: string[]): string {
	const combined = strings.join("|");
	return nodeCreateHash("sha256").update(combined).digest("hex").slice(0, 16);
}

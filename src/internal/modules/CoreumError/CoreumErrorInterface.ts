import type { Status } from "@/internal/enums/Status";

export interface CoreumErrorInterface extends Error {
	message: string;
	status: Status;
	data?: unknown;
}

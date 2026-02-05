import type { Status } from "@/internal/Status/Status";

export class CoreumError extends Error {
	constructor(
		public override message: string,
		public status: Status,
		public data?: unknown,
	) {
		super(message);
	}
}

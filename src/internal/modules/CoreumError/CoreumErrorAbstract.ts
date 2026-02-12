import type { Status } from "@/internal/enums/Status";
import type { CoreumErrorInterface } from "@/internal/modules/CoreumError/CoreumErrorInterface";

export abstract class CoreumErrorAbstract
	extends Error
	implements CoreumErrorInterface
{
	constructor(
		public override message: string,
		public status: Status,
		public data?: unknown,
	) {
		super(message);
	}
}

import type { Func } from "@/utils/functions";

import type { Req } from "@/Req/Req";
import type { RouterData } from "@/Router/RouterData";
import type { RouterReturn } from "@/Router/RouterReturn";

export interface RouterAdapterInterface {
	readonly __brand: string;
	find(req: Req): RouterReturn | null;
	add(data: RouterData): void;
	list: Func<[], Array<RouterData>> | undefined;
}

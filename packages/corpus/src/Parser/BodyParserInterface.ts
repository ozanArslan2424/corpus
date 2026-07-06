import type { UnknownArray } from "@/utils/UnknownArray";
import type { UnknownObject } from "@/utils/UnknownObject";

import type { Req } from "@/Req/Req";
import type { Res } from "@/Res/Res";

export interface BodyParserInterface {
	parse(
		r: Req | Res | Response,
	): Promise<UnknownObject | UnknownArray | string | ReadableStream<Uint8Array>>;
}

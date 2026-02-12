import type { CoreumRequestInterface } from "@/internal/modules/CoreumRequest/CoreumRequestInterface";

import { CoreumRequestAbstract } from "@/internal/modules/CoreumRequest/CoreumRequestAbstract";

/** CoreumRequest includes a cookie jar, better headers, and some utilities. */

export class CoreumRequest
	extends CoreumRequestAbstract
	implements CoreumRequestInterface {}

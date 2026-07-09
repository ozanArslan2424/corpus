# X Modules

The X modules provide optional utilities and extensions for common web application concerns. These are not core framework features but solve frequent problems with sensible defaults and minimal configuration.

<section class="table-of-contents">

##### Contents

1. [X.RateLimiter](#xratelimiter)
2. [X.File](#xfile)
3. [X.Config](#xconfig)
4. [X.InferModel](#xinfermodel)

</section>

## X.RateLimiter

Intelligent rate limiting with tiered identification and multiple storage backends.

```ts
import { X } from "@ozanarslan/corpus";

// Default: memory store, 120/60/20 requests per minute
new X.RateLimiter();
```

Automatically classifies requests by trust level: authenticated users (JWT), IP addresses, or browser fingerprints. See [XRateLimiter](/xratelimiter.html) for details.

## X.File

File system abstraction with MIME type detection.

```ts
import { C, X } from "@ozanarslan/corpus";

const file = new X.File("assets/report.pdf");

if (await file.exists()) {
	console.log(file.mimeType); // "application/pdf"
	return C.Res.file(file); // or file.path
}
```

See [XFile](/xfile.html) for streaming and full API.

## X.Config

Typed environment variable access with parsing, fallbacks, and fail-fast validation.

```ts
import { X } from "@ozanarslan/corpus";

const port = X.Config.get("PORT", { parser: Number, fallback: 3000 });
const dbUrl = X.Config.require("DATABASE_URL");

if (X.Config.isProd) {
	// Production-only logic
}
```

See [XConfig](/xconfig.html) for the full API including `has`, `set`, and environment checks.

## X.InferModel

Helper type for inferring all schemas from a single object containing multiple RouteModels. Useful when you prefer to colocate all your route schemas in one place.

```ts
import { X } from "@ozanarslan/corpus";

class UserModel {
	static entity = z.object({
		id: z.number(),
		name: z.string(),
	});

	static create = {
		body: z.object({ name: z.string() }),
		response: this.entity,
	};

	static single = {
		params: z.object({ id: z.coerce.number() }),
		response: this.entity,
	};
}

type UserModelType = X.InferModel<typeof UserModel>;
// UserModelType["create"] --> { body: { name: string }, response: { id: number, name: string } }
// UserModelType["single"] --> { params: { id: number }, response: { id: number, name: string } }
```

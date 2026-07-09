# XRateLimiter

The `XRateLimiter` class provides intelligent rate limiting with tiered identification, multiple storage backends, and privacy-preserving hashing. It automatically registers as global middleware and classifies requests by trust level: authenticated users (highest), IP addresses (moderate), or browser fingerprints (lowest).

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Configuration](#configuration)
3. [Storage Backends](#storage-backends)
4. [Identification Tiers](#identification-tiers)
5. [Headers](#headers)

</section>

## Usage

Normally instantiation of middlewares before routes is accepted and middlewares are correctly applied. However, RateLimiter ignores bundle routes by default and MUST be instantiated after all routes are registered.

### Basic setup

```ts
import { X } from "@ozanarslan/corpus";

// Default: memory store, 120/60/20 limits per minute
new X.RateLimiter();
```

### Custom limits

```ts
new X.RateLimiter({
	limits: { u: 200, i: 100, f: 30 }, // 200 user, 100 IP, 30 fingerprint
	windowMs: 60_000, // 1 minute window
});
```

## Configuration

### RateLimitConfig

| Option           | Type                                   | Default                    | Description                         |
| ---------------- | -------------------------------------- | -------------------------- | ----------------------------------- |
| limits           | `Record<"u" \| "i" \| "f", number>`    | `{ u: 120, i: 60, f: 20 }` | Request limits per tier             |
| windowMs         | `number`                               | `60000`                    | Time window in milliseconds         |
| saltRotateMs     | `number`                               | `86400000`                 | Salt rotation interval (24h)        |
| cleanProbability | `number`                               | `0.005`                    | Chance (0-1) of cleanup per request |
| maxStoreSize     | `number`                               | `50000`                    | Force cleanup threshold             |
| storeType        | `"memory" \| "file" \| "custom"`       | `"memory"`                 | Storage backend                     |
| store            | `RateLimitStoreInterface \| undefined` | `undefined`                | Required when storeType is custom   |
| storeDir         | `string`                               | `os.tmpdir()`              | Directory for file store            |
| headerNames      | `object`                               | See below                  | Custom header names                 |

### Default header names

```ts
{
	limit: "RateLimit-Limit",
	remaining: "RateLimit-Remaining",
	reset: "RateLimit-Reset",
	retryAfter: "Retry-After"
}
```

## Storage Backends

### Memory (default)

Fastest option. Resets on server restart. Best for single-instance deployments.

```ts
new X.RateLimiter({ storeType: "memory" });
```

### File

Persistent across restarts. Good for single-instance deployments needing persistence.

```ts
new X.RateLimiter({
	storeType: "file",
	storeDir: "./data/rate-limits",
});
```

### Custom

You probably want to use Redis for multi-instance deployments. Example adapter code can be found at [XRateLimiter DIY](/xratelimiter/diy/redis.html).

```ts
class CustomStore implements X.RateLimitStoreInterface {
	// ...
}

new X.RateLimiter({
	storeType: "custom",
	store: new CustomStore(),
});
```

## Identification Tiers

Requests are classified into tiers based on available identification:

| Tier        | Prefix | Source                                                | Trust    | Default Limit |
| ----------- | ------ | ----------------------------------------------------- | -------- | ------------- |
| User        | `u:`   | JWT token from `Authorization` header                 | Highest  | 120           |
| IP          | `i:`   | `CF-Connecting-IP`, `X-Real-IP`, or `X-Forwarded-For` | Moderate | 60            |
| Fingerprint | `f:`   | Hash of User-Agent, Accept-Language, Accept-Encoding  | Lowest   | 20            |

### Identification order

1. Extracts JWT from `Authorization: Bearer <token>`
2. Falls back to IP address validation
3. Falls back to browser fingerprint

### Privacy features

- IP addresses are hashed with a rotating salt (prevents long-term tracking)
- Salt rotates every 24 hours by default
- Fingerprints use hashed combinations, not raw values

## Headers

The middleware automatically sets rate limit headers on all responses:

| Header                        | Description                          |
| ----------------------------- | ------------------------------------ |
| RateLimit-Limit               | Maximum requests allowed in window   |
| RateLimit-Remaining           | Remaining requests in current window |
| RateLimit-Reset               | Unix timestamp when window resets    |
| Retry-After                   | Seconds to wait (only when limited)  |
| Access-Control-Expose-Headers | Exposes rate limit headers to CORS   |

### Custom header names

```ts
new X.RateLimiter({
	headerNames: {
		limit: "X-RateLimit-Limit",
		remaining: "X-RateLimit-Remaining",
		reset: "X-RateLimit-Reset",
		retryAfter: "Retry-After",
	},
});
```

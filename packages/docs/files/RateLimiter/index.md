# RateLimiter

Request rate limiting, as a ready-made `Middleware`.

`RateLimiter` counts requests per caller within a rolling window and
rejects anything over the limit with [`Status.TOO_MANY_REQUESTS`](../Res/index.md#status-too-many-requests). Who
"the caller" is depends on what the request proves about itself: an
authenticated request is identified by its token, an unauthenticated one by
its IP, and one with neither by a fingerprint of its headers. Each tier gets
its own limit, since they differ in how accountable and how forgeable they
are.

Identifiers are hashed with a rotating salt before being stored, so the
limiter never holds a token or an IP in memory.

```ts
import { RateLimiter } from "@ozanarslan/corpus";

new RateLimiter({ windowMs: 60_000, limits: { authenticated: 120, ipBased: 60, fingerprint: 20 } });
```

Counting is backed by [`RateLimiterStoreInterface`](#ratelimiterstoreinterface); the default
[`RateLimiterMemoryStore`](#ratelimitermemorystore) is per-process, so a multi-instance deployment
wants a shared store instead.

## RateLimiter

_class_

```ts
class RateLimiter extends Middleware
```

A `Middleware` that limits how often a caller may make requests.

Every response carries the limit, the remaining allowance and the reset time,
and those header names are added to
[`HeaderKey.AccessControlExposeHeaders`](../Headers/index.md#headerkey-accesscontrolexposeheaders) so browser clients can actually
read them. Exceeding the limit throws an `Exception` carrying the
response built so far, so the rejection keeps its rate limit headers.

### RateLimiter.constructor()

```ts
constructor(config: Partial<RateLimiterConfig>= {})
```

Creates a limiter and registers it on the nearest `App`.

It targets the routes registered so far, minus
[`RouteVariant.bundle`](../RouteBase/index.md#routevariant-bundle) ones — a single page load pulls dozens of
assets, which would exhaust any sensible limit. Construct it after your
routes; routes registered later are not covered.

**Parameters**

- `config` — Overrides for `defaultConfig`. Merged shallowly, so supplying `limits` or `headerNames` replaces that group whole.

### RateLimiter.handler

```ts
override handler: MiddlewareHandler
```

Counts the request and either continues the chain or rejects it.

**Parameters**

- `c` — The `Context` for the request.
- `next` — Runs the rest of the chain.

**Throws** — `Exception` with [`Status.TOO_MANY_REQUESTS`](../Res/index.md#status-too-many-requests) when the limit is exceeded. The current `Res` is passed as the exception data, so the rejection carries the rate limit headers already set on it.

### RateLimiter.getResult()

```ts
async getResult(reqHeaders: Headers, resHeaders: Headers): Promise<boolean>
```

Counts one request against its caller's allowance and writes the rate limit
headers.

A window is created on the first request and reused until
`RateLimiterEntry.resetAt` passes, at which point the counter starts
over — a fixed window, not a sliding one. The hit is counted whether or not
it is allowed, so a caller that keeps hammering a closed window stays closed
until it resets.

Exposed separately from [`RateLimiter.handler`](#ratelimiter-handler) so the same accounting
can be driven from outside a request chain, in tests or a custom handler.

**Parameters**

- `reqHeaders` — The request headers, used to identify the caller.
- `resHeaders` — The response headers to write the limit, remaining, reset and — when rejected — retry-after values into.

**Returns** — `true` when the request is within the limit.

### RateLimiter.config

```ts
protected readonly config: RateLimiterConfig
```

The merged settings this limiter runs with.

### RateLimiter.store

```ts
protected readonly store: RateLimiterStoreInterface
```

Where counters are kept. The configured store, or a [`RateLimiterMemoryStore`](#ratelimitermemorystore).

### RateLimiter.storedSalt

```ts
protected storedSalt: string
```

The current hashing salt. Rotated by [`RateLimiter.salt`](#ratelimiter-salt).

### RateLimiter.saltRotatesAt

```ts
protected saltRotatesAt: number
```

Unix milliseconds at which [`RateLimiter.storedSalt`](#ratelimiter-storedsalt) is replaced.

### RateLimiter.getIdAndLimit()

```ts
protected getIdAndLimit(headers: Headers): Tuple<string, number>
```

Identifies the caller and picks the limit that applies to it.

Three tiers are tried in order of how much the request proves about itself.
A bearer token of plausible length identifies an authenticated caller and
earns the highest limit. Failing that, a valid address from the proxy
headers earns the IP limit — shared by everyone behind a NAT, hence lower.
Failing that, a fingerprint of the user agent and accept headers earns the
lowest limit, since it is trivially forgeable.

Tokens are hashed without the salt so a caller keeps one bucket across
rotations; addresses and fingerprints are salted, so they cannot be
correlated across rotation windows.

The prefixes (`u:`, `i:`, `f:`) keep the tiers in separate namespaces, so a
collision across tiers is impossible.

**Parameters**

- `headers` — The request headers.

**Returns** — A `Tuple` of the hashed identifier and the applicable limit.

### RateLimiter.salt()

```ts
protected salt(): string
```

Returns the current hashing salt, rotating it when it has expired.

Rotation is lazy rather than scheduled, so no timer is held open. A rotation
changes every derived identifier at once, which resets the affected
counters — acceptable at a daily cadence, and the point: it bounds how long
any caller can be tracked.

**Returns** — The salt to mix into address and fingerprint hashes.

### RateLimiter.maybeCleanStore()

```ts
protected async maybeCleanStore(): Promise<void>
```

Decides whether to sweep expired entries before handling a request.

Cleanup runs on a small random fraction of requests, so the cost is spread
out instead of landing on a timer, and unconditionally once the store passes
[`RateLimiterConfig.maxStoreSize`](#ratelimiterconfig-maxstoresize), which bounds memory under a flood of
one-off callers.

### RateLimiter.cleanStore()

```ts
protected async cleanStore(): Promise<number>
```

Removes every entry whose window has ended.

**Returns** — How many entries remain.

### RateLimiter.clearStore()

```ts
async clearStore(): Promise<void>
```

Clears every counter, expired or not, resetting all callers to a full
allowance. Mainly useful between tests.

### RateLimiter.getStoreSize()

```ts
async getStoreSize(): Promise<number>
```

**Returns** — How many counters are currently held, expired ones included until the next cleanup.

## RateLimiterMemoryStore

_class_

```ts
class RateLimiterMemoryStore implements RateLimiterStoreInterface
```

In-process counter storage, used when no store is configured.

Writes are serialised per identifier through a promise lock, so concurrent
requests from the same caller cannot interleave their read-modify-write and
lose a hit.

State lives in one process's memory, so it is lost on restart and not shared
between instances — behind a load balancer, each instance enforces the limit
separately. Use a shared [`RateLimiterStoreInterface`](#ratelimiterstoreinterface) when that matters.

### RateLimiterMemoryStore.map

```ts
protected readonly map
```

The counters, keyed by hashed identifier.

### RateLimiterMemoryStore.locks

```ts
protected readonly locks
```

In-flight write locks, keyed by identifier. Present only while a write is running.

### RateLimiterMemoryStore.get()

```ts
get(id: string): RateLimiterEntry | undefined
```

Reads a caller's entry.

**Parameters**

- `id` — The hashed caller identifier.

**Returns** — The entry, or `undefined` when absent. Expired entries are returned as-is; the limiter checks `RateLimiterEntry.resetAt` itself.

### RateLimiterMemoryStore.set()

```ts
async set(id: string, entry: RateLimiterEntry): Promise<void>
```

Writes a caller's entry, waiting for any write already in progress for the
same identifier.

**Parameters**

- `id` — The hashed caller identifier.
- `entry` — The counter to store.

### RateLimiterMemoryStore.delete()

```ts
delete(id: string): void
```

Removes a caller's entry.

**Parameters**

- `id` — The hashed caller identifier.

### RateLimiterMemoryStore.cleanup()

```ts
cleanup(now: number): void
```

Removes every entry whose window has already ended.

**Parameters**

- `now` — Unix milliseconds to compare against.

### RateLimiterMemoryStore.clear()

```ts
clear(): void
```

Removes every entry, resetting all counters.

### RateLimiterMemoryStore.size()

```ts
size(): number
```

**Returns** — How many entries are currently held.

## RateLimiterStoreInterface

_interface_

```ts
interface RateLimiterStoreInterface
```

The storage contract for rate limit counters.

Implement it to back the limiter with Redis or anything else shared across
processes — the default [`RateLimiterMemoryStore`](#ratelimitermemorystore) only counts within one.
Every method may be synchronous or asynchronous; the limiter awaits either.

### RateLimiterStoreInterface.get()

```ts
get(id: string): MaybePromise<RateLimiterEntry | undefined>
```

Reads a caller's entry.

**Parameters**

- `id` — The hashed caller identifier.

**Returns** — The entry, or `undefined` when the caller has none.

### RateLimiterStoreInterface.set()

```ts
set(id: string, entry: RateLimiterEntry): MaybePromise<void>
```

Writes a caller's entry, replacing any existing one.

**Parameters**

- `id` — The hashed caller identifier.
- `entry` — The counter to store.

### RateLimiterStoreInterface.delete()

```ts
delete(id: string): MaybePromise<void>
```

Removes a caller's entry.

**Parameters**

- `id` — The hashed caller identifier.

### RateLimiterStoreInterface.cleanup()

```ts
cleanup(now: number): MaybePromise<void>
```

Removes every entry whose window has ended.

**Parameters**

- `now` — Unix milliseconds to compare against `RateLimiterEntry.resetAt`.

### RateLimiterStoreInterface.clear()

```ts
clear(): MaybePromise<void>
```

Removes every entry, expired or not.

### RateLimiterStoreInterface.size()

```ts
size(): MaybePromise<number>
```

Reports how many entries are held.

**Returns** — The entry count, used to decide when a cleanup is forced.

## RateLimiterConfig

_type_

```ts
type RateLimiterConfig = {
	/** Limits based on identifier type: */ limits: {
		/** Authenticated users — higher limit, accountable identity(e.g., 120 requests)*/ authenticated: number;
		/** IP-based — moderate, may be shared(NAT, proxies)(e.g., 60 requests)*/ ipBased: number;
		/** Fingerprint / anonymous — lowest, least trustworthy(e.g., 20 requests)*/ fingerprint: number;
	};
	/** * You can pass a different header key to check for authenticated users. * "Bearer " string is only sliced for Authorization. * */ authHeader?: OrString<"Authorization">;
	/** Time window in milliseconds during which the rate limit applies(default: 60, 000ms = 1 minute)*/ windowMs: number;
	/** * How often to rotate the salt used for hashing identifiers(default: 24h)* Prevents long-term tracking and adds an extra layer of privacy * */ saltRotateMs: number;
	/** * Probability(0-1)of triggering a cleanup of expired entries on each request * Balances memory usage against performance(default: 0.005 = 0.5%)* */ cleanProbability: number;
	/** * Maximum number of entries before forcing a cleanup * Prevents unbounded memory growth(default: 50, 000)* */ maxStoreSize: number;
	/** * Bring your own store implementation like redis. * Uses [`RateLimiterMemoryStore`](#ratelimitermemorystore) by default. * */ store?: RateLimiterStoreInterface;
	/** * Customizable HTTP header names for rate limit information. * Allows integration with different API conventions or frontend expectations. * * @example * // Custom header names(e.g., for legacy systems)* headerNames: { * limit: "X-RateLimit-Limit", * remaining: "X-RateLimit-Remaining", * reset: "X-RateLimit-Reset", * retryAfter: "Retry-After" * } * * @default Uses standard RateLimit-* headers as defined in IETF draft: * - limit: "RateLimit-Limit" * - remaining: "RateLimit-Remaining" * - reset: "RateLimit-Reset" * - retryAfter: "Retry-After" */ headerNames: {
		/** Header name for the maximum allowed requests in the current window */ limit: string;
		/** Header name for the remaining requests in the current window */ remaining: string;
		/** Header name for the timestamp(Unix seconds)when the window resets */ reset: string;
		/** Header name for seconds to wait before retrying when rate limited */ retryAfter: string;
	};
};
```

The limiter's settings. `RateLimiter` merges what you pass over
`defaultConfig`, so every field is optional at the call site.

### RateLimiterConfig.limits

```ts
limits: {
	/** Authenticated users — higher limit, accountable identity(e.g., 120 requests)*/ authenticated: number;
	/** IP-based — moderate, may be shared(NAT, proxies)(e.g., 60 requests)*/ ipBased: number;
	/** Fingerprint / anonymous — lowest, least trustworthy(e.g., 20 requests)*/ fingerprint: number;
}
```

Limits based on identifier type:

### RateLimiterConfig.authHeader

```ts
authHeader?: OrString<"Authorization">
```

You can pass a different header key to check for authenticated users.
"Bearer " string is only sliced for Authorization.

### RateLimiterConfig.windowMs

```ts
windowMs: number;
```

Time window in milliseconds during which the rate limit applies (default: 60,000ms = 1 minute)

### RateLimiterConfig.saltRotateMs

```ts
saltRotateMs: number;
```

How often to rotate the salt used for hashing identifiers (default: 24h)
Prevents long-term tracking and adds an extra layer of privacy

### RateLimiterConfig.cleanProbability

```ts
cleanProbability: number;
```

Probability (0-1) of triggering a cleanup of expired entries on each request
Balances memory usage against performance (default: 0.005 = 0.5%)

### RateLimiterConfig.maxStoreSize

```ts
maxStoreSize: number;
```

Maximum number of entries before forcing a cleanup
Prevents unbounded memory growth (default: 50,000)

### RateLimiterConfig.store

```ts
store?: RateLimiterStoreInterface
```

Bring your own store implementation like redis.
Uses [`RateLimiterMemoryStore`](#ratelimitermemorystore) by default.

### RateLimiterConfig.headerNames

```ts
headerNames: {
	/** Header name for the maximum allowed requests in the current window */ limit: string;
	/** Header name for the remaining requests in the current window */ remaining: string;
	/** Header name for the timestamp(Unix seconds)when the window resets */ reset: string;
	/** Header name for seconds to wait before retrying when rate limited */ retryAfter: string;
}
```

Customizable HTTP header names for rate limit information.
Allows integration with different API conventions or frontend expectations.

**Default** — Uses standard RateLimit-* headers as defined in IETF draft: - limit: "RateLimit-Limit" - remaining: "RateLimit-Remaining" - reset: "RateLimit-Reset" - retryAfter: "Retry-After"

```ts
// Custom header names (e.g., for legacy systems)
headerNames: {
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  reset: "X-RateLimit-Reset",
  retryAfter: "Retry-After"
}
```

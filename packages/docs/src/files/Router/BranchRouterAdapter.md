# BranchRouterAdapter

`BranchRouterAdapter` is the default `RouterAdapterInterface` implementation in the registry. It is a radix tree (compressed prefix tree) router: routes are stored as branches keyed by their shared path prefixes, and each branch holds a per-method store, so a lookup walks the URL once and returns both the matched route and its URL parameters.

The core branch-matching algorithm comes from [@medley/router](https://github.com/medleyjs/router) by [Nathan Woltman](https://github.com/nwoltman), converted to TypeScript and adapted to this package's conventions.

Replace it through the [Registry](/Registry.html) if you want different matching behavior. For an example, see [DIY: MemoiristAdapter](/Router/DIY:%20MemoiristAdapter.html).

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Path Syntax](#path-syntax)
3. [Match Precedence](#match-precedence)
4. [Route Conflicts](#route-conflicts)
5. [Methods](#methods)
6. [Performance](#performance)

</section>

## Usage

You don't call the adapter directly. The router owns it, and route registration (`new C.Route(...)`, `Controller.route(...)`, and every other route class) ends up calling `add` on it. Reference this page when you need to know exactly which route a given URL will match, or when writing your own adapter.

## Path Syntax

Three segment kinds are supported:

| Kind      | Syntax       | Example endpoint | Matches                  | Params                 |
| --------- | ------------ | ---------------- | ------------------------ | ---------------------- |
| Static    | plain text   | `/users/list`    | `/users/list` only       | none                   |
| Parameter | `:name`      | `/users/:id`     | `/users/5`, `/users/abc` | `{ id: "5" }`          |
| Wildcard  | trailing `*` | `/assets/*`      | `/assets/a/b/c.png`      | `{ "*": "a/b/c.png" }` |

Notes on each:

- **Leading slash is optional.** An endpoint that doesn't start with `/` gets one prepended, so `users` and `/users` register the same route.
- **Parameters cannot be empty.** `/users/:id` does not match `/users/` or `/users`. A parameter also stops at the next `/`, so it never spans multiple segments.
- **Wildcards capture the remainder** under the `*` key, including slashes. Matching the wildcard endpoint exactly (`/assets/` against `/assets/*`) gives an empty string for `*`.
- **Parameters are raw here.** The adapter slices them straight out of the pathname; decoding and coercion happen later in [URLParamsParser](/Parser/URLParamsParser.html).

## Match Precedence

At each branch, the adapter tries in this order and returns the first hit:

1. **Static children.** The most specific match wins, and static matching is attempted depth-first, so a failed static branch falls through rather than aborting the lookup.
2. **Parameter branch.** Only when the segment is non-empty.
3. **Wildcard store.** The fallback that consumes whatever is left.

So with `/users/new`, `/users/:id`, and `/users/*` all registered, a request to `/users/new` matches the static route, `/users/5` matches the parameter route, and `/users/a/b` matches the wildcard.

Method matching happens after the path matches. If a path resolves to a branch but that branch has no store for the request method, `find` returns `null` rather than falling back to another path.

## Route Conflicts

Two routes cannot use different parameter names in the same position. Registering both `/users/:id` and `/users/:slug` throws:

```
Cannot create route "/users/:slug" with parameter "slug". A route already exists
with a different parameter name ("id") in the same location.
```

Rename one of them so both positions agree. Registering the same method and endpoint twice does not throw; the later registration overwrites the earlier one in that branch's method store.

## Methods

### find

`find(req: Req): RouterReturn | null`

Resolves `req.urlObject.pathname` against the tree and looks up `req.method` (uppercased) in the matched store. Returns `{ route, params }` on a hit, `null` when either the path or the method misses.

### add

`add(data: RouterData): void`

Creates or reuses the branch for `data.endpoint` and stores `data` under `data.method`. Called automatically when a route registers itself.

### list

`list(): Array<RouterData>`

Walks the whole tree and returns every registered route: static stores, wildcard stores, and parameter branches at every depth. Useful for startup logging and for tooling that needs the full route table, like the API client generator.

## Performance

Lookups do no allocation for static routes and build the params object only when a parameter or wildcard actually matches. Short branch parts (under 15 characters) are compared with a character loop rather than `slice`, which avoids the intermediate string.

Benchmark with 600 registered routes and 60,000 lookups:

| Metric     | Value      |
| ---------- | ---------- |
| Setup time | 1.20ms     |
| Hit rate   | 100.00%    |
| Accuracy   | 100.00%    |
| Average    | 0.0000ms   |
| P95        | 0.0000ms   |
| P99        | 0.0006ms   |
| Max        | 0.1079ms   |
| Throughput | ~20.4M rps |

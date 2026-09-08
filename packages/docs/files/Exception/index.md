# Exception

Throwing HTTP errors with a status attached.

All errors are caught by [`App.handleError`](../App/index.md#app-handleerror), whatever their type. What an
`Exception` adds is the [`Status`](../Res/index.md#status) to answer with: it is rendered
through [`Exception.toRes`](#exception-tores), message and detail intact, while an ordinary
error becomes an opaque [`Status.INTERNAL_SERVER_ERROR`](../Res/index.md#status-internal-server-error) so an accidental
`TypeError` does not leak its message to the client.

Throwing one is the intended way to end a request early:

```ts
import { Exception, Status } from "@ozanarslan/corpus";

if (!user) throw new Exception("User not found", Status.NOT_FOUND);
```

Subclass it for errors you raise often, so the status and message live in one
place rather than at every throw site.

## Exception

_class_

```ts
class Exception extends Error
```

An error carrying the [`Status`](../Res/index.md#status) it should be answered with.

Beyond a status, an exception can carry [`Exception.data`](#exception-data) — either
arbitrary detail to include in the error body, or a fully formed `Res`
when the error response needs its own headers or shape.

### Exception.constructor()

```ts
constructor();
constructor(message: string, status: Status, data?: unknown);
constructor(message?: string, status?: Status, data?: unknown)
```

Creates an exception for subclasses, which assign
[`Exception.message`](#exception-message), [`Exception.status`](#exception-status) and
[`Exception.data`](#exception-data) themselves.

Creates an exception to throw from a handler.

**Parameters**

- `message` — Human-readable description. It is sent to the client, so write it for whoever receives the response.
- `status` — The [`Status`](../Res/index.md#status) to answer with.
- `data` — Optional detail attached to the response body under `error`, such as validation failures. Pass a `Res` instead to control the whole error response — see [`Exception.toRes`](#exception-tores).

### Exception.message

```ts
override message!: string
```

Human-readable description, sent to the client in the error body.

### Exception.status

```ts
status!: Status
```

The [`Status`](../Res/index.md#status) the response is sent with.

### Exception.data

```ts
data?: unknown
```

Optional detail. An arbitrary value is placed under `error` in the response
body; a `Res` is used as the response itself.

### Exception.toRes()

```ts
toRes(): Res
```

Renders the exception as the response to send.

When [`Exception.data`](#exception-data) is a `Res`, that response is used directly:
its status is overwritten with [`Exception.status`](#exception-status), and the message is
filled in only if the body does not already carry one, so a body you wrote
yourself is left alone. Otherwise a fresh `Res` is built with the
message and the detail under `error`.

**Returns** — The `Res` for this error. Called by [`App.handleError`](../App/index.md#app-handleerror).

### Exception.isStatusOf()

```ts
isStatusOf(status: Status | keyof typeof Status): boolean
```

Checks the exception's status, by numeric value or by [`Status`](../Res/index.md#status) name.

Useful when catching an exception to branch on what went wrong:

```ts
if (err instanceof Exception && err.isStatusOf("NOT_FOUND")) { … }
```

**Parameters**

- `status` — A [`Status`](../Res/index.md#status) value or one of its keys.

**Returns** — `true` when [`Exception.status`](#exception-status) matches.

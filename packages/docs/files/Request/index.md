# Request

HTTP method constants, and the `Request` extensions the framework relies on.

[`Method`](#method) gives the verbs as documented constants. [`patchGlobalRequest`](#patchglobalrequest)
then adds two properties to the global `Request`: `params`, which `App`
fills with the matched path parameters before parsing, and `cookies`, which
parses the `Cookie` header into a `Cookies` map on first access.

Like [`patchGlobalHeaders`](../Headers/index.md#patchglobalheaders), this must be installed once at startup,
before any request is served.

## RequestInit

_interface_ — augments `global`

```ts
interface RequestInit
```

| Name      | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `cookies` | Cookies to seed the request with. Anything in the `Cookie` header is layered on top of these. |

## Request

_interface_ — augments `global`

```ts
interface Request
```

The `Request` surface after [`patchGlobalRequest`](#patchglobalrequest) has run.

| Name      | Description                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`  | The raw path parameters matched by the route, populated by Bun's router. [`Context.params`](../Context/index.md#context-params) holds the parsed, validated version. |
| `cookies` | The request's cookies, parsed from the `Cookie` header on first access.                                                                                              |

## patchGlobalRequest

_function_

```ts
function patchGlobalRequest();
```

Installs `params` and `cookies` on the global `Request`. Call it once at
startup, before any request is served.

The patch is applied twice over, for the same reason as
[`patchGlobalHeaders`](../Headers/index.md#patchglobalheaders). The prototype is extended so requests _the runtime_
creates — every incoming request Bun hands to the server — carry the
properties, since those never pass through a constructor the framework
controls. The global class is then replaced too, so manually constructed
requests can seed their cookies from [`RequestInit.cookies`](#requestinit-cookies), which the
prototype path has no access to.

The subclass overrides `Symbol.hasInstance` to defer to the native class, so
`instanceof Request` stays true for requests created outside the patch.

## Method

_const_

```ts
const Method;
type Method = OrString<ValueOf<typeof Method>>;
```

Commonly used HTTP verbs. See [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) for the full spec.

An HTTP method. The [`Method`](#method) constants are suggested, but
`OrString` keeps any custom verb assignable.

| Name      | Value       | Description                                |
| --------- | ----------- | ------------------------------------------ |
| `GET`     | `"GET"`     | Retrieve a resource from the server.       |
| `POST`    | `"POST"`    | Submit data to create a new resource.      |
| `PUT`     | `"PUT"`     | Replace an entire resource with new data.  |
| `PATCH`   | `"PATCH"`   | Apply partial modifications to a resource. |
| `DELETE`  | `"DELETE"`  | Remove a resource from the server.         |
| `HEAD`    | `"HEAD"`    | Get response headers without body.         |
| `OPTIONS` | `"OPTIONS"` | Discover communication options.            |
| `CONNECT` | `"CONNECT"` | Establish tunnel to server.                |
| `TRACE`   | `"TRACE"`   | Echo back received request.                |

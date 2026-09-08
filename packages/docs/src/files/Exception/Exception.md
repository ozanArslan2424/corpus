# Exception

The `Exception` class extends native `Error` with HTTP status codes and optional data payload. It provides a `response` getter for converting errors into `Res` objects, making it ideal for consistent error handling across your application.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)
4. [Methods](#methods)

</section>

## Usage

### Throwing errors in routes

```ts
import { C } from "@ozanarslan/corpus";

new C.Route("/users/:id", (c) => {
	const user = findUser(c.params.id);

	if (!user) {
		throw new C.Exception("User not found", C.Status.NOT_FOUND);
	}

	return user;
});
```

### With custom data payload

```ts
new C.Route("/validate", (c) => {
	const errors = validate(c.body);

	if (errors.length > 0) {
		throw new C.Exception("Validation failed", C.Status.BAD_REQUEST, { errors });
	}

	return { valid: true };
});
```

### Using the response getter

```ts
new C.Route("/handle", async (c) => {
	try {
		return await riskyOperation();
	} catch (err) {
		if (err instanceof C.Exception) {
			// this is already done in the Server.handleError
			return err.response;
		}
		throw err;
	}
});
```

### Checking error status

```ts
new C.Middleware({
	variant: "inbound",
	useOn: "*",
	handler: (c) => {
		try {
			return c.next();
		} catch (err) {
			if (err instanceof C.Exception && err.isStatusOf(C.Status.UNAUTHORIZED)) {
				c.res.headers.set("X-Auth-Required", "true");
			}
			throw err;
		}
	},
});
```

## Constructor Parameters

### message

`string`

The error message. Available on `error.message`.

### status

`Status`

HTTP status code for this error. Use `C.Status` enum for standard codes.

### data (optional)

`unknown`

Additional data to include in the response. If a `Res` is passed, it will be modified with the status code and returned as-is in the `res` getter.

## Properties

| Property | Type      | Description                           |
| -------- | --------- | ------------------------------------- |
| message  | `string`  | Error message (inherited from Error)  |
| status   | `Status`  | HTTP status code                      |
| data     | `unknown` | Optional additional payload           |
| response | `Res`     | Getter to transform to Res, see below |

### response

`get response(): Res`

Converts the error to a `Res`:

- If `data` is a `Res` — returns it with `status` applied
- Otherwise — returns JSON response with `{ error, message }` shape

```ts
// With plain data
const err = new C.Exception("Not found", C.Status.NOT_FOUND);
return err.response;
// → Res with body { error: true, message: "Not found" }

// With Res data
const err = new C.Exception("Failed", C.Status.BAD_REQUEST, new C.Res("custom"));
return err.response; // → The passed Res with status 400
```

## Methods

### isStatusOf

`isStatusOf(status: Status): boolean`

Checks if the error matches a specific HTTP status code.

```ts
const err = new C.Exception("Not found", C.Status.NOT_FOUND);
err.isStatusOf(C.Status.NOT_FOUND); // true
err.isStatusOf(C.Status.BAD_REQUEST); // false
```

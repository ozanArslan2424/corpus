# Model

The Model system provides type-safe request/response validation through the [Standard Schema](https://github.com/standard-schema) specification. Define schemas for body, search params, URL params, and response data — the parsed results are typed and available on the context.

<section class="table-of-contents">

##### Contents

1. [RouteModel](#routemodel)
2. [Schema](#schema)
3. [InferSchema](#inferschema)
4. [XInferModel](#xinfermodel)

</section>

## RouteModel

Type for defining validation schemas on routes. All fields are optional — include only what you need to validate.

| Property | Type   | Validates                          |
| -------- | ------ | ---------------------------------- |
| body     | Schema | Request body (POST/PUT/PATCH)      |
| search   | Schema | URL search/query parameters        |
| params   | Schema | URL path parameters                |
| response | Schema | Response data (for type inference) |

```ts
import { C } from "@ozanarslan/corpus";
import { z } from "zod";

const UserModel = {
	body: z.object({ name: z.string(), email: z.string().email() }),
	params: z.object({ id: z.coerce.number() }),
	response: z.object({ id: z.number(), name: z.string() }),
};

new C.Route(
	{ method: C.Method.POST, path: "/users/:id" },
	(c) => {
		// c.body is typed as { name: string; email: string }
		// c.params is typed as { id: number }
		return { id: c.params.id, name: c.body.name };
	},
	UserModel,
);
```

See [Standard Schema](https://github.com/standard-schema) for supported validation libraries (Zod, Valibot, ArkType, etc.).

## Schema

Base interface extending Standard Schema v1. Any library implementing this spec can be used with Corpus.

```ts
interface Schema<T = unknown> extends StandardSchemaV1<unknown, T> {}
```

Popular compatible libraries include [Zod](https://zod.dev), [Yup](https://github.com/jquense/yup), and [ArkType](https://arktype.io).

## InferSchema

Helper type to extract the output type from a Schema.

```ts
type InferSchema<T extends Schema> = StandardSchemaV1.InferOutput<T>;

// Usage
const UserSchema = z.object({ name: z.string() });
type User = InferSchema<typeof UserSchema>; // { name: string }
```

## XInferModel

Part of the Extra (X) module.

Helper type for inferring all schemas from a single object containing multiple RouteModels. Useful when you prefer to colocate all your route schemas in one place.

```ts
import { C, X } from "@ozanarslan/corpus";

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

type M = X.InferModel<typeof UserModel>;
// M["create"] = { body: { name: string }, response: { id: number, name: string } }
// M["single"] = { params: { id: number }, response: { id: number, name: string } }
```

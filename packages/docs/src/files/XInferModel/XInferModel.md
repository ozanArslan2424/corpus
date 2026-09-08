# XInferModel

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

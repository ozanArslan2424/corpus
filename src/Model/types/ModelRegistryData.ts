import type { SchemaValidator } from "./SchemaValidator";

export type ModelRegistryData<B = unknown, S = unknown, P = unknown> = {
	body?: SchemaValidator<B>;
	search?: SchemaValidator<S>;
	params?: SchemaValidator<P>;
};

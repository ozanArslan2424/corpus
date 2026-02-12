import type { SchemaType } from "@/internal/types/SchemaType";

export type RouteSchemas<R = unknown, B = unknown, S = unknown, P = unknown> = {
	response?: SchemaType<R>;
	body?: SchemaType<B>;
	search?: SchemaType<S>;
	params?: SchemaType<P>;
};

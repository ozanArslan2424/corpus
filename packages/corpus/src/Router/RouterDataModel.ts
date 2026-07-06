import type { SchemaValidator } from "@/utils/Schema";

export type RouterDataModel = {
	body?: SchemaValidator<any>;
	search?: SchemaValidator<any>;
	params?: SchemaValidator<any>;
};

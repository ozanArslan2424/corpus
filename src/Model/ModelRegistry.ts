import type { ModelRegistryData } from "@/Model/types/ModelRegistryData";
import type { RouteId } from "@/Route/types/RouteId";
import type { Schema } from "@/Model/types/Schema";
import type { SchemaValidator } from "@/Model/types/SchemaValidator";
import { strRemoveWhitespace } from "@/utils/strRemoveWhitespace";
import type { AnyRouteModel } from "@/Model/types/AnyRouteModel";

export class ModelRegistry {
	readonly data = new Map<RouteId, ModelRegistryData>();
	// Schemas can be repeated, this helps with pointer references
	private internMap = new Map<string, SchemaValidator>();

	private internValidator(schema: Schema<any>): SchemaValidator {
		const value = schema["~standard"].validate;
		const key = strRemoveWhitespace(JSON.stringify(schema));
		const existing = this.internMap.get(key);
		if (existing) return existing;
		this.internMap.set(key, value);
		return value;
	}

	add(routeId: RouteId, model: AnyRouteModel): void {
		const entry: ModelRegistryData = {};

		if (model.body) {
			entry["body"] = this.internValidator(model.body);
		}

		if (model.params) {
			entry["params"] = this.internValidator(model.params);
		}

		if (model.search) {
			entry["search"] = this.internValidator(model.search);
		}

		this.data.set(routeId, entry);
	}

	find(routeId: RouteId): ModelRegistryData | undefined {
		return this.data.get(routeId);
	}
}

import { Status } from "@/enums/Status";
import { Exception } from "@/Exception/Exception";
import type { SchemaParserInterface } from "@/Registry/types";
import { isObjectWith } from "@/utils/objects";
import type { Schema, ValidationIssues } from "@/utils/Schema";

export class SchemaParser implements SchemaParserInterface {
	parse<T = Record<string, unknown>>(label: string, data: unknown, schema?: Schema<T>): T {
		if (!schema) return data as T;
		const result = schema["~standard"].validate(data);
		if (result instanceof Promise || typeof (result as any)?.then === "function") {
			throw new Error("async validators are not supported — use a sync schema library");
		}
		if (result.issues !== undefined) {
			const msg = this.issuesToErrorMessage(label, data, result.issues);
			throw new Exception(msg, Status.UNPROCESSABLE_ENTITY, data);
		}
		return result.value;
	}

	issuesToErrorMessage(label: string, data: unknown, issues: ValidationIssues): string {
		if (issues.length === 0) return "";

		return issues
			.map((issue) => {
				// Handle global issues without a path
				if (!issue.path || issue.path.length === 0) {
					return issue.message;
				}

				// Extract the string representation of the path
				const pathKeys = issue.path.map((segment) =>
					isObjectWith<{ key: string }>(segment, "key")
						? String(segment.key)
						: String(segment as string),
				);

				const key = pathKeys.join(".");

				// Traverse the input data to find the specific value at this path
				const value = pathKeys.reduce<unknown>((acc, segment) => {
					if (acc && typeof acc === "object") {
						return (acc as Record<string, unknown>)[segment];
					}
					return undefined;
				}, data);

				// Format: "key (received value): message"
				const received = value !== undefined ? ` (received ${JSON.stringify(value)})` : "";

				return `in ${label} ${key}${received}: ${issue.message}`;
			})
			.join("\n");
	}
}

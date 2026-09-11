/**
 * Request validation against the schemas declared in a {@link RouteConfig}.
 *
 * Schemas are taken as [Standard Schema](https://standardschema.dev), so any
 * library implementing that spec works — Zod, Valibot, ArkType and others —
 * without corpus depending on any of them. The same interface also supplies the
 * inferred types that flow into {@link Context}, so declaring a schema both
 * validates the request and types the handler.
 *
 * {@link App} calls this after each surface is parsed, so what a handler sees on
 * {@link Context.body}, {@link Context.search} and {@link Context.params} is
 * already validated. A failure raises {@link Status.UNPROCESSABLE_ENTITY} with a
 * message naming the offending fields, so the client is told what was wrong
 * rather than just that something was.
 *
 * @module SchemaParser
 */

import { Exception } from "@/Exception";
import { Status } from "@/Res";
import type { RouteConfig } from "@/RouteBase";
import type { Prettify } from "@/utils/object";

// #region inlined standard spec - https://standardschema.dev/schema

/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
	/** The Standard Schema properties. */
	readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

declare namespace StandardSchemaV1 {
	/** The Standard Schema properties interface. */
	export interface Props<Input = unknown, Output = Input> {
		/** The version number of the standard. */
		readonly version: 1;
		/** The vendor name of the schema library. */
		readonly vendor: string;
		/** Validates unknown input values. */
		readonly validate: (
			value: unknown,
			options?: StandardSchemaV1.Options | undefined,
		) => Result<Output> | Promise<Result<Output>>;
		/** Inferred types associated with the schema. */
		readonly types?: Types<Input, Output> | undefined;
	}

	/** The result interface of the validate function. */
	export type Result<Output> = SuccessResult<Output> | FailureResult;

	/** The result interface if validation succeeds. */
	export interface SuccessResult<Output> {
		/** The typed output value. */
		readonly value: Output;
		/** A falsy value for `issues` indicates success. */
		readonly issues?: undefined;
	}

	export interface Options {
		/** Explicit support for additional vendor-specific parameters, if needed. */
		readonly libraryOptions?: Record<string, unknown> | undefined;
	}

	/** The result interface if validation fails. */
	export interface FailureResult {
		/** The issues of failed validation. */
		readonly issues: ReadonlyArray<Issue>;
	}

	/** The issue interface of the failure output. */
	export interface Issue {
		/** The error message of the issue. */
		readonly message: string;
		/** The path of the issue, if any. */
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	/** The path segment interface of the issue. */
	export interface PathSegment {
		/** The key representing a path segment. */
		readonly key: PropertyKey;
	}

	/** The Standard Schema types interface. */
	export interface Types<Input = unknown, Output = Input> {
		/** The input type of the schema. */
		readonly input: Input;
		/** The output type of the schema. */
		readonly output: Output;
	}

	/** Infers the input type of a Standard Schema. */
	export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["input"];

	/** Infers the output type of a Standard Schema. */
	export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
		Schema["~standard"]["types"]
	>["output"];
}

// #endregion

/**
 * Any Standard Schema validator producing `T`. This is the type
 * {@link RouteConfig} fields accept.
 *
 * @typeParam T - What the schema validates to.
 */
type Schema<T = unknown> = StandardSchemaV1<unknown, T>;

/**
 * The type a schema accepts as input, before transformation.
 *
 * @typeParam T - The schema.
 */
type InferSchemaIn<T extends Schema> = StandardSchemaV1.InferInput<T>;

/**
 * The type a schema produces after validation. This is what a route's
 * {@link Context} fields are typed as.
 *
 * @typeParam T - The schema.
 */
type InferSchemaOut<T extends Schema> = StandardSchemaV1.InferOutput<T>;

/** The validation failures a schema reports. */
type ValidationIssues = readonly StandardSchemaV1.Issue[];

/** If you prefer to put all schemas into a single object, this will be helpful */
type InferModel<T extends Record<string, any>> = {
	[K in keyof T as K extends "prototype" ? never : K]: T[K] extends RouteConfig<any, any, any, any>
		? Prettify<
				(T[K]["body"] extends Schema ? { body: InferSchemaOut<T[K]["body"]> } : {}) &
					(T[K]["search"] extends Schema ? { search: InferSchemaOut<T[K]["search"]> } : {}) &
					(T[K]["params"] extends Schema ? { params: InferSchemaOut<T[K]["params"]> } : {}) &
					(T[K]["response"] extends Schema ? { response: InferSchemaOut<T[K]["response"]> } : {})
			>
		: T[K] extends Schema
			? InferSchemaOut<T[K]>
			: never;
};

/**
 * The public shape of a schema parser, implemented by {@link SchemaParser}.
 * Assign an alternative to {@link ParsersRegistry.schemaParser} to change how
 * validation failures are reported.
 */
interface SchemaParserInterface {
	/**
	 * Validates a value against a schema.
	 *
	 * @param label - Names the surface being validated, for the error message.
	 * @param input - The value to validate.
	 * @param schema - The schema. Omitting it passes the value through unchanged.
	 * @returns The validated value.
	 */
	parse<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): Promise<T>;
	/**
	 * Validates a value against a synchronous schema.
	 *
	 * @param label - Names the surface being validated, for the error message.
	 * @param input - The value to validate.
	 * @param schema - The schema. Omitting it passes the value through unchanged.
	 * @returns The validated value.
	 */
	parseSync<T = Record<string, unknown>>(label: string, input: unknown, schema?: Schema<T>): T;
}

/**
 * Default {@link SchemaParserInterface} implementation.
 *
 * A missing schema is not an error — the value passes through untouched, which
 * is what makes {@link RouteConfig} entirely optional.
 */
class SchemaParser implements SchemaParserInterface {
	/**
	 * Validates a value against a schema.
	 *
	 * This is what {@link App} uses during the request lifecycle, since a schema
	 * may validate asynchronously.
	 *
	 * @param label - Names the surface being validated — `"body"`, `"search"` or
	 * `"params"` — and appears in the error message.
	 * @param data - The value to validate, already parsed from the request.
	 * @param schema - The schema from the route's {@link RouteConfig}. Omitting it
	 * returns the data as-is.
	 * @returns The validated value, with whatever transformations the schema
	 * applies.
	 * @throws {@link Exception} with {@link Status.UNPROCESSABLE_ENTITY} when
	 * validation fails, carrying the rejected data as exception data.
	 */
	async parse<T = Record<string, unknown>>(
		label: string,
		data: unknown,
		schema?: Schema<T>,
	): Promise<T> {
		if (!schema) return data as T;
		const result = await schema["~standard"].validate(data);
		if (result.issues !== undefined) {
			const msg = this.issuesToErrorMessage(label, data, result.issues);
			throw new Exception(msg, Status.UNPROCESSABLE_ENTITY, data);
		}
		return result.value;
	}

	/**
	 * Validates a value without awaiting, for callers that cannot be async.
	 *
	 * Whether a schema validates synchronously is not visible in its type, so it
	 * is detected at runtime: a validator that returns a promise is rejected
	 * outright rather than having its result silently used as a value.
	 *
	 * @param label - Names the surface being validated, and appears in the error
	 * message.
	 * @param data - The value to validate.
	 * @param schema - The schema. Omitting it returns the data as-is.
	 * @returns The validated value.
	 * @throws {@link Error} when the schema validates asynchronously — use
	 * {@link SchemaParser.parse} instead.
	 * @throws {@link Exception} with {@link Status.UNPROCESSABLE_ENTITY} when
	 * validation fails.
	 */
	parseSync<T = Record<string, unknown>>(label: string, data: unknown, schema?: Schema<T>): T {
		if (!schema) return data as T;
		const result = schema["~standard"].validate(data);
		const isThenable = "then" in result && typeof result?.then === "function";
		if (result instanceof Promise || isThenable) {
			throw new Error("parseSync called with async validator — use a sync schema library");
		}
		if (result.issues !== undefined) {
			const msg = this.issuesToErrorMessage(label, data, result.issues);
			throw new Exception(msg, Status.UNPROCESSABLE_ENTITY, data);
		}
		return result.value;
	}

	/**
	 * Renders validation issues into the message sent to the client.
	 *
	 * Each issue is reported as `in <label> <path> (received <value>): <message>`,
	 * so a client can see which field failed and what it actually sent — a
	 * schema's own message alone rarely says which field it came from. Path
	 * segments are joined with dots, and the offending value is looked up by
	 * walking the original data along that path. Issues with no path are global to
	 * the surface and keep their message unadorned.
	 *
	 * Override this to change the wording or to withhold the received values.
	 *
	 * @param label - Names the surface being validated.
	 * @param data - The value that failed, walked to find each reported value.
	 * @param issues - The failures the schema reported.
	 * @returns One line per issue, newline-joined, or an empty string when there
	 * are none.
	 */
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
					typeof segment === "object" && segment !== null && "key" in segment
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

export {
	type SchemaParserInterface,
	SchemaParser,
	type Schema,
	type InferSchemaIn,
	type InferSchemaOut,
	type ValidationIssues,
	type InferModel,
};

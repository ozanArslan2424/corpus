import { AsyncLocalStorage } from "node:async_hooks";

import type { Context } from "@ozanarslan/corpus";

export type AnyContext = Context<any, any, any, any>;

/** A loader signature: its parameters are the dependencies, its return is the data. */
export type AnyLoader = (...deps: Array<any>) => any;

/** The dependencies a loader declares, as the tuple a page is called with. */
export type LoaderDeps<L> = L extends AnyLoader ? Parameters<L> : [];

/** The data a loader resolves to. `undefined` when there is no loader. */
export type LoaderData<L> = L extends AnyLoader ? Awaited<ReturnType<L>> : undefined;

export interface PendingState {
	status: "pending";
	data: undefined;
	error: undefined;
}
export interface SuccessState<Data> {
	status: "success";
	data: Data;
	error: undefined;
}
export interface ErrorState {
	status: "error";
	data: undefined;
	error: unknown;
}

/** A loader as the render sees it. Narrow on `status` to get `data` or `error`. */
export type LoaderState<Data> = PendingState | SuccessState<Data> | ErrorState;

/** A loader that has finished: what components always see, and what the final pass of a page/layout sees. */
export type SettledState<Data> = SuccessState<Data> | ErrorState;

export type LoaderStatus = LoaderState<unknown>["status"];

/** `"pending"`: render with whatever has resolved so far. `"settled"`: wait for every loader. */
export type RenderMode = "pending" | "settled";

const PENDING: PendingState = { status: "pending", data: undefined, error: undefined };

function success<Data>(data: Data): SuccessState<Data> {
	return { status: "success", data, error: undefined };
}

function failure(error: unknown): ErrorState {
	return { status: "error", data: undefined, error };
}

interface Entry {
	promise: Promise<void>;
	state: LoaderState<unknown>;
}

interface Scope {
	c: AnyContext;
	mode: RenderMode;
	/** One entry per page/layout, so a loader runs once across both passes of a request. */
	entries: Map<object, Entry>;
}

const storage = new AsyncLocalStorage<Scope>();

/** Runs one request's renders with a shared loader cache. */
export function runRenderScope<T>(c: AnyContext, fn: () => Promise<T>): Promise<T> {
	return storage.run({ c, mode: "settled", entries: new Map() }, fn);
}

export function setRenderMode(mode: RenderMode): void {
	const scope = storage.getStore();
	if (scope) scope.mode = mode;
}

/** The context of the request being rendered. Also available as `this` inside a loader. */
export function renderContext(): AnyContext {
	const scope = storage.getStore();
	if (!scope) throw new Error("No render in progress: loaders only run while a page is rendering");
	return scope.c;
}

/** Starts a loader. A synchronous one settles immediately, so the pending pass already sees its result. */
function start(load: () => unknown): Entry {
	const entry: Entry = { promise: Promise.resolve(), state: PENDING };
	try {
		const result = load();
		if (result instanceof Promise) {
			entry.promise = result.then(
				(data: unknown) => {
					entry.state = success(data);
				},
				(error: unknown) => {
					entry.state = failure(error);
				},
			);
		} else entry.state = success(result);
	} catch (error) {
		entry.state = failure(error);
	}
	return entry;
}

/** Runs `load` once per request, keyed by `key`. In `"pending"` mode it returns the state as it stands. */
export async function loaderState<Data>(
	key: object,
	load: (() => Bun.MaybePromise<Data>) | undefined,
): Promise<LoaderState<Data>> {
	if (!load) return success(undefined as Data);

	const scope = storage.getStore();
	if (!scope) return settleLoader(load);

	let entry = scope.entries.get(key);
	if (!entry) {
		entry = start(load);
		scope.entries.set(key, entry);
	}
	if (scope.mode === "settled") await entry.promise;
	return entry.state as LoaderState<Data>;
}

/** The recorded state of `key`'s loader, or `undefined` when it never ran. */
export function loadedState(key: object): LoaderState<unknown> | undefined {
	return storage.getStore()?.entries.get(key)?.state;
}

/** Runs `load` and waits for it. Loaders that aren't cached per request (components) go through here. */
export async function settleLoader<Data>(
	load: () => Bun.MaybePromise<Data>,
): Promise<SettledState<Data>> {
	try {
		return success(await load());
	} catch (error) {
		return failure(error);
	}
}

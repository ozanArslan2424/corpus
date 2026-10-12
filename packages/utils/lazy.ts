import { EMPTY } from "./is";

interface LazyFn {
	<T>(init: () => T): Lazy<T>;
	mut<T>(init: () => T): LazyMut<T>;
	synced<T>(init: LazySyncedInit<T>): LazyMut<T>;
}

interface Lazy<T> {
	(): T;
	/** Whether the value has been created yet. Reading it does not create one. */
	readonly initialized: boolean;
}

interface LazyMut<T> extends Lazy<T> {
	set(value: T): void;
}

/**
 * Hooks that intercept reads and writes. Both return the value to store,
 * so they can rewrite state rather than just observe it - return the
 * argument unchanged for a pure side effect.
 */
interface SyncCallbacks<T> {
	onGet?(value: T): T;
	onSet?(value: T, prev: T): T;
}

interface LazySyncedInit<T> extends SyncCallbacks<T> {
	init(): T;
}

/** The deferred value itself, shared by all three forms. */
interface LazyCell<T> {
	/** Reads the value, running `init` on first access. */
	get(): T;
	/** Overwrites the value without running `init`. */
	put(value: T): void;
	/** Whether `init` has run or a value has been put. */
	readonly initialized: boolean;
}

/**
 * Holds the deferred value. `EMPTY` marks the uninitialized state so that a
 * legitimately `undefined` value still counts as initialized.
 *
 * @param init - Builds the value on first read.
 * @returns The cell.
 */
function createCell<T>(init: () => T): LazyCell<T> {
	let _state: T | EMPTY = EMPTY;
	return {
		get: () => (_state === EMPTY ? (_state = init()) : _state),
		put: (value: T) => {
			_state = value;
		},
		get initialized() {
			return _state !== EMPTY;
		},
	};
}

/**
 * Attaches the `initialized` flag to a lazy function.
 *
 * A getter rather than a plain property, since the cell's state changes after
 * the function is built.
 *
 * @param fn - The lazy function to augment. Mutated in place.
 * @param cell - The {@link LazyCell} it reads from.
 * @returns The same function.
 */
function withInitialized<T, L extends Lazy<T>>(fn: L, cell: LazyCell<T>): L {
	Object.defineProperty(fn, "initialized", { get: () => cell.initialized });
	return fn;
}

/**
 * Defers `init` until the first call, then caches it forever.
 */
function lazyBase<T>(init: () => T): Lazy<T> {
	const cell = createCell(init);
	return withInitialized((() => cell.get()) as Lazy<T>, cell);
}

/**
 * Lazy value that can be overwritten via `set`. Setting before the
 * first read skips `init` entirely - it will never run.
 */
function lazyMut<T>(init: () => T): LazyMut<T> {
	const cell = createCell(init);
	const fn = withInitialized((() => cell.get()) as LazyMut<T>, cell);
	fn.set = cell.put;
	return fn;
}

/**
 * Lazy value with read/write hooks. Unlike `lazy.mut`, `set` forces
 * initialization first so that `onSet` always receives a real `prev`.
 * `onGet` runs on every read, including the one that triggers `init`.
 */
function lazySynced<T>({ init, onGet, onSet }: LazySyncedInit<T>): LazyMut<T> {
	const cell = createCell(init);
	const fn = withInitialized(
		(() => {
			const value = cell.get();
			if (!onGet) return value;
			const next = onGet(value);
			cell.put(next);
			return next;
		}) as LazyMut<T>,
		cell,
	);
	fn.set = (value: T) => {
		const prev = cell.get();
		cell.put(onSet ? onSet(value, prev) : value);
	};
	return fn;
}

const lazy: LazyFn = Object.assign(lazyBase, { mut: lazyMut, synced: lazySynced });

export type { Lazy, LazyMut };
export { lazy };

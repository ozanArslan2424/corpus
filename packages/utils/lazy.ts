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

/**
 * Defers `init` until the first call, then caches it forever.
 *
 * `EMPTY` marks the uninitialized state so that a legitimately `undefined`
 * value still counts as initialized. `initialized` is a plain writable
 * property rather than an accessor: a getter on a function object costs a call
 * on every read and moves the object off its fast path, and the two places
 * that mutate state can just as well write the flag themselves.
 */
function lazyBase<T>(init: () => T): Lazy<T> {
	let _state: T | EMPTY = EMPTY;
	const fn = (() => {
		if (_state === EMPTY) {
			_state = init();
			mut.initialized = true;
		}
		return _state;
	}) as Lazy<T>;
	const mut = fn as { initialized: boolean };
	mut.initialized = false;
	return fn;
}

/**
 * Lazy value that can be overwritten via `set`. Setting before the
 * first read skips `init` entirely - it will never run.
 */
function lazyMut<T>(init: () => T): LazyMut<T> {
	let _state: T | EMPTY = EMPTY;
	const fn = (() => {
		if (_state === EMPTY) {
			_state = init();
			fn.initialized = true;
		}
		return _state;
	}) as LazyMut<T> & { initialized: boolean };
	fn.initialized = false;
	fn.set = (value: T) => {
		_state = value;
		fn.initialized = true;
	};
	return fn;
}

/**
 * Lazy value with read/write hooks. Unlike `lazy.mut`, `set` forces
 * initialization first so that `onSet` always receives a real `prev`.
 * `onGet` runs on every read, including the one that triggers `init`.
 */
function lazySynced<T>({ init, onGet, onSet }: LazySyncedInit<T>): LazyMut<T> {
	let _state: T | EMPTY = EMPTY;

	function read(): T {
		if (_state === EMPTY) {
			_state = init();
			fn.initialized = true;
		}
		return _state;
	}

	const fn = (() => {
		const value = read();
		if (!onGet) return value;
		return (_state = onGet(value));
	}) as LazyMut<T> & { initialized: boolean };
	fn.initialized = false;
	fn.set = (value: T) => {
		const prev = read();
		_state = onSet ? onSet(value, prev) : value;
	};
	return fn;
}

const lazy: LazyFn = Object.assign(lazyBase, { mut: lazyMut, synced: lazySynced });

export type { Lazy, LazyMut };
export { lazy };

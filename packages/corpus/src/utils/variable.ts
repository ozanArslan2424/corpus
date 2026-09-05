import { EMPTY } from "@/utils/maybe";

interface LazyFn {
	<T>(init: () => T): Lazy<T>;
	mut<T>(init: () => T): LazyMut<T>;
	synced<T>(init: LazySyncedInit<T>): LazyMut<T>;
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

interface Lazy<T> {
	(): T;
}

/**
 * Defers `init` until the first call, then caches it forever.
 * `EMPTY` marks the uninitialized state so that a legitimately
 * `undefined` value still counts as initialized.
 */
const lazy = (<T>(init: () => T): Lazy<T> => {
	let _state: T | EMPTY = EMPTY;

	return () => {
		if (_state === EMPTY) _state = init();
		return _state;
	};
}) as LazyFn;

interface LazyMut<T> extends Lazy<T> {
	set(value: T): void;
}

/**
 * Lazy value that can be overwritten via `set`. Setting before the
 * first read skips `init` entirely - it will never run.
 */
lazy.mut = <T>(init: () => T): LazyMut<T> => {
	let _state: T | EMPTY = EMPTY;

	const fn = (() => {
		if (_state === EMPTY) _state = init();
		return _state;
	}) as LazyMut<T>;

	fn.set = (value: T) => {
		_state = value;
	};

	return fn;
};

interface LazySyncedInit<T> extends SyncCallbacks<T> {
	init(): T;
}

/**
 * Lazy value with read/write hooks. Unlike `lazy.mut`, `set` forces
 * initialization first so that `onSet` always receives a real `prev`.
 * `onGet` runs on every read, including the one that triggers `init`.
 */
lazy.synced = <T>({ init, onGet, onSet }: LazySyncedInit<T>): LazyMut<T> => {
	let _state: T | EMPTY = EMPTY;

	const fn = (() => {
		if (_state === EMPTY) _state = init();
		if (onGet) _state = onGet(_state);
		return _state;
	}) as LazyMut<T>;

	fn.set = (value: T) => {
		if (_state === EMPTY) _state = init();
		const prev = _state;
		_state = onSet ? onSet(value, prev) : value;
	};

	return fn;
};

interface Synced<T> {
	(): T;
	set(value: T): void;
}

interface SyncedInit<T> extends SyncCallbacks<T> {
	value: T;
}

/**
 * Eager counterpart to `lazy.synced` - the value is present from the
 * start, so there is no `EMPTY` state and `prev` is always a real `T`.
 */
const synced = <T>({ value, onGet, onSet }: SyncedInit<T>): Synced<T> => {
	let _state = value;

	const fn = (() => {
		if (onGet) _state = onGet(_state);
		return _state;
	}) as Synced<T>;

	fn.set = (next: T) => {
		const prev = _state;
		_state = onSet ? onSet(next, prev) : next;
	};

	return fn;
};

export type { Lazy, LazyMut, Synced };
export { lazy, synced };

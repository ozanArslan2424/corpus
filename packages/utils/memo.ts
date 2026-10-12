/**
 * Caches a function's result on the identity of its arguments.
 *
 * Lookups walk a tree one level per argument, so arity is part of the key:
 * `f(1)` and `f(1, undefined)` are distinct entries. Object and function
 * arguments are held weakly, so an entry keyed on something that gets collected
 * goes with it; primitive arguments are held strongly and never evicted, which
 * is why this must not be keyed on client-controlled values.
 *
 * Arguments are compared by `SameValueZero` — the rule `Map` uses — so `NaN`
 * matches itself and `-0` matches `0`. Structurally equal but distinct objects
 * are different keys; this caches on identity, never on shape.
 *
 * @module memo
 */

/** One level of the argument tree. */
interface MemoNode<R> {
	/** The result, once a full argument list has reached this node. */
	result?: R;
	/**
	 * Whether {@link MemoNode.result} has been filled. A flag rather than an
	 * `undefined` check, so a function that legitimately returns `undefined` is
	 * still cached.
	 */
	settled: boolean;
	/** Children keyed by a primitive argument. Held strongly. */
	primitives?: Map<unknown, MemoNode<R>>;
	/** Children keyed by an object or function argument. Held weakly. */
	objects?: WeakMap<object, MemoNode<R>>;
}

/**
 * @returns An empty, unsettled node.
 */
function createNode<R>(): MemoNode<R> {
	return { settled: false };
}

/**
 * @param value - The argument to test.
 * @returns `true` when the value can key a `WeakMap`.
 */
function isWeakKey(value: unknown): value is object {
	return value !== null && (typeof value === "object" || typeof value === "function");
}

/**
 * Memoizes a pure function.
 *
 * @param fn - The function to cache. Must be pure and must not rely on `this`:
 * its first result for a given argument identity is returned forever.
 * @returns A function with the same signature, backed by the cache.
 */
function memo<A extends ReadonlyArray<unknown>, R>(fn: (...args: A) => R): (...args: A) => R {
	const root = createNode<R>();

	return (...args: A): R => {
		let node = root;

		for (const arg of args) {
			if (isWeakKey(arg)) {
				node.objects ??= new WeakMap();
				let next = node.objects.get(arg);
				if (!next) {
					next = createNode<R>();
					node.objects.set(arg, next);
				}
				node = next;
			} else {
				node.primitives ??= new Map();
				let next = node.primitives.get(arg);
				if (!next) {
					next = createNode<R>();
					node.primitives.set(arg, next);
				}
				node = next;
			}
		}

		if (node.settled) return node.result as R;

		const result = fn(...args);
		node.result = result;
		node.settled = true;
		return result;
	};
}

export { memo };

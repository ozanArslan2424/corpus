export type Lazy<T> = () => T;

export type LazyList<T> = Lazy<{
	head: Lazy<T>;
	tail: LazyList<T>;
} | null>;

export function lazy<T>(x: T): Lazy<T> {
	return () => x;
}

export function toLazyList<T>(xs: T[]): LazyList<T> {
	return () => {
		if (xs.length === 0) return null;
		return {
			head: () => xs[0]!,
			tail: toLazyList(xs.slice(1)),
		};
	};
}

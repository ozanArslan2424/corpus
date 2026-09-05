export type Tuple<T, U> = [T, U];

export function tuple<T, U>(arg1: T, arg2: U): Tuple<T, U> {
	return [arg1, arg2];
}

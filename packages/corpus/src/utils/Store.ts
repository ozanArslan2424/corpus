export class Store<T> {
	constructor(protected init: T) {
		this.value = init;
	}

	protected value: T;

	set(value: T) {
		this.value = value;
		this.init = value;
	}

	get(): T {
		return this.value;
	}

	reset(): void {
		this.value = this.init;
	}
}

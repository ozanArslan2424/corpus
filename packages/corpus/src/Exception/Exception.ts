import { Status } from "@/enums/Status";
import { Res } from "@/Res/Res";

export class Exception extends Error {
	constructor(
		public override message: string,
		public status: Status,
		public data?: unknown,
	) {
		super(message);
	}

	get response(): Res {
		if (this.data instanceof Res) {
			this.data.status = this.status;
			return this.data;
		}

		return new Res({ error: this.data ?? true, message: this.message }, { status: this.status });
	}

	isStatusOf(status: Status): boolean {
		return this.status === status;
	}
}

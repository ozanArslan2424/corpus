import { Res, Status } from "@/Res";
import { assertDefined } from "@/utils/assert";

class Exception extends Error {
	constructor();
	constructor(message: string, status: Status, data?: unknown);
	constructor(message?: string, status?: Status, data?: unknown) {
		super(message);

		if (new.target !== Exception) return;
		const msg = "Exception must be constructed with (message, status, data?) or extended.";
		assertDefined(message, msg);
		assertDefined(status, msg);
		this.message = message;
		this.status = status;
		this.data = data;
	}

	override message!: string;
	status!: Status;
	data?: unknown;

	toRes(): Res {
		// if (isObject(data) && "status" in data && typeof data.status === "number") {
		// 	status = data.status;
		// } else if (data instanceof Res) {
		// 	data.status = status;
		// 	return data;
		// }
		if (this.data instanceof Res) {
			this.data.body = { message: this.message };
			this.data.status = this.status;
			return this.data;
		}
		return new Res({ error: this.data, message: this.message }, { status: this.status });
	}

	isStatusOf(status: Status | keyof typeof Status): boolean {
		return typeof status === "number" ? this.status === status : this.status === Status[status];
	}
}

export { Exception };

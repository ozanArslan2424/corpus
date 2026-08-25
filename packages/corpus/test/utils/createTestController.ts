import { TC } from "../_modules";

export function createTestController<Px extends string>(prefix: Px) {
	class TestController extends TC.Controller<Px> {
		constructor() {
			super(prefix);
		}

		cr1 = this.route("/cr1", (c) => c.data);
		cr2 = this.route("cr2", (c) => c.data);
	}

	return new TestController();
}

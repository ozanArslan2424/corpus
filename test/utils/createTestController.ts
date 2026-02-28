import C from "@/index";

export function createTestController(prefix: string) {
	class TestController extends C.Controller {
		constructor() {
			super({ prefix });
		}
		cr1 = this.route("/cr1", (c) => c.data);
		cr2 = this.route("cr2", (c) => c.data);
	}

	return new TestController();
}

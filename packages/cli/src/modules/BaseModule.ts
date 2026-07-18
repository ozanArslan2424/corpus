import { ModuleAbstract } from "@/utils/ModuleAbstract";

export class BaseModule extends ModuleAbstract {
	override keys = ["base"];
	override help: string[] = [];
	override main(): void | Promise<void> {
		throw new Error("Method not implemented.");
	}
}

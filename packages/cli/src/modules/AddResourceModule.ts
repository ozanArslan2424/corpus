import { MainFileUpdater } from "@/classes/MainFileUpdater";
import { Resource } from "@/classes/Resource";
import { EXE_NAME, NAME_FLAG_HELP } from "@/constants";
import type { AddControllerModule } from "@/modules/AddControllerModule";
import type { AddExceptionModule } from "@/modules/AddExceptionModule";
import type { AddModelModule } from "@/modules/AddModelModule";
import type { AddServiceModule } from "@/modules/AddServiceModule";
import { assert } from "@/utils/assert";
import { ModuleAbstract } from "@/utils/ModuleAbstract";
import { quote } from "@/utils/strings";

export class AddResourceModule extends ModuleAbstract {
	constructor(
		private readonly mainFileUpdater: MainFileUpdater,
		private readonly addModelModule: AddModelModule,
		private readonly addExceptionModule: AddExceptionModule,
		private readonly addServiceModule: AddServiceModule,
		private readonly addControllerModule: AddControllerModule,
	) {
		super();
	}

	override keys: string[] = ["resource", "res"];
	override get help(): string[] {
		return [
			"Scaffold a new resource (model, service, controller, exception).",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the resource to generate.`,
			"  --empty             Generate a bare model with no default CRUD shape.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);
		const r = new Resource(name);

		this.writeFile(this.addModelModule.buildModelFile(r.model, r.modelTypeName), [
			r.model.filePath,
		]);
		this.writeFile(this.addExceptionModule.buildExceptionFile(r.exception), [r.exception.filePath]);
		this.writeFile(this.addServiceModule.buildServiceFile(r.service, r.model, r.exception), [
			r.service.filePath,
		]);
		this.writeFile(this.addControllerModule.buildControllerFile(r.controller, r.model, r.service), [
			r.controller.filePath,
		]);

		this.mainFileUpdater.addLines(
			"import",
			`import { ${r.service.pascalName} } from ${quote(r.service.importFrom(this.config.main))};`,
			`import { ${r.controller.pascalName} } from ${quote(r.controller.importFrom(this.config.main))};`,
		);
		this.mainFileUpdater.addLines(
			"service",
			`const ${r.service.camelName} = new ${r.service.pascalName}();`,
		);
		this.mainFileUpdater.addLines(
			"controller",
			`new ${r.controller.pascalName}(${r.service.camelName});`,
		);
	}
}

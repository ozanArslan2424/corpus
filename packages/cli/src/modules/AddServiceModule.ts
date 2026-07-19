import fs from "fs";

import { Importable } from "@/classes/Importable";
import { MainFileUpdater } from "@/classes/MainFileUpdater";
import { EXE_NAME, NAME_FLAG_HELP, NEVER_SCHEMAS } from "@/constants";
import { checkNotImplementedExceptionExists } from "@/functions/checkNotImplementedExceptionExists";
import { parseModelDefinition } from "@/functions/parseModelDefinition";
import { assert } from "@/utils/assert";
import { ModuleAbstract } from "@/utils/ModuleAbstract";
import { objGetEntries, objGetValues } from "@/utils/objects";
import { StringBuilder } from "@/utils/StringBuilder";

export class AddServiceModule extends ModuleAbstract {
	constructor(private readonly mainFileUpdater: MainFileUpdater) {
		super();
	}

	override keys: string[] = ["service", "svc"];
	override get help(): string[] {
		return [
			"Scaffold a standalone service with stubbed CRUD methods.",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the service to generate.`,
			"  --empty             Generate a bare model with no default CRUD shape.",
			"",
			"Note: this only generates the service file. Without a matching model,",
			"the stubbed methods will be untyped.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);

		const service = new Importable(name, "service");
		const model = new Importable(name, "model");
		const exception = new Importable(service.resourceName, "exception");

		this.writeFile(this.buildServiceFile(service, model, exception), [service.filePath]);

		this.mainFileUpdater.addLines(
			"import",
			`import { ${service.pascalName} } from "${service.importFrom(this.config.main)}";`,
		);
		this.mainFileUpdater.addLines(
			"service",
			`const ${service.camelName} = new ${service.pascalName}();`,
		);
	}

	buildServiceFile(service: Importable, model: Importable, exception: Importable): string {
		const modelExists = fs.existsSync(model.filePath);
		if (modelExists) {
			return this.buildServiceFileWithModel(service, model, exception);
		}

		if (this.flags.empty) {
			return this.buildEmptyServiceFile(service);
		}

		return this.buildServiceFileWithDefaults(service, exception);
	}

	private buildEmptyServiceFile(service: Importable) {
		const b = new StringBuilder();

		b.line(`export class ${service.pascalName} {`);
		b.line(1)(`constructor() {}`);
		b.line(`}`);

		return b.toString();
	}

	private buildServiceFileWithDefaults(service: Importable, exception: Importable) {
		const b = new StringBuilder();
		const methods = this.config.defaultMethods;
		const notImplementedExceptionExists = checkNotImplementedExceptionExists(exception);

		if (notImplementedExceptionExists) {
			b.line(
				`import { ${exception.pascalName} } from "${exception.importFrom(service.filePath)}";`,
			).line(``);
		}

		b.line(`export class ${service.pascalName} {`);
		b.line(1)(`constructor() {}`);

		for (const { propertyKey } of objGetValues(methods)) {
			b.line(``);
			b.line(1)(`async ${propertyKey}(): Promise<void> {`);
			if (notImplementedExceptionExists) {
				b.line(2)(`throw ${exception.pascalName}.NotImplemented;`);
			} else {
				b.line(2)(`throw new Error("Method not implemented.");`);
			}
			b.line(1)(`}`);
		}

		b.line(`}`);

		return b.toString();
	}

	private buildServiceFileWithModel(service: Importable, model: Importable, exception: Importable) {
		const b = new StringBuilder();
		const { modelTypeName, modelDef } = parseModelDefinition(model);
		const notImplementedExceptionExists = checkNotImplementedExceptionExists(exception);

		if (notImplementedExceptionExists) {
			b.line(
				`import { ${exception.pascalName} } from "${exception.importFrom(service.filePath)}";`,
			);
		}

		b.line(`import type { ${modelTypeName} } from "${model.importFrom(service.filePath)}";`);

		b.line("");
		b.line(`export class ${service.pascalName} {`);
		b.line(1)(`constructor() {}`);

		const isNeverSchema = (schema: string) => NEVER_SCHEMAS.has(schema.trim());

		for (const [key, val] of objGetEntries(modelDef)) {
			const ORDER = ["params", "search", "body"] as const;
			const usedParams = ORDER.filter((k) => k in val && !isNeverSchema(val[k]!));
			const funcParams = usedParams
				.map((k) => `${k}: ${modelTypeName}["${key}"]["${k}"]`)
				.join(", ");
			const returnType =
				"response" in val && !isNeverSchema(val.response!)
					? `${modelTypeName}["${key}"]["response"]`
					: "void";
			b.line(``);
			b.line(1)(`async ${key}(${funcParams}): Promise<${returnType}> {`);
			for (const param of usedParams) {
				b.line(2)(`void ${param};`);
			}
			if (notImplementedExceptionExists) {
				b.line(2)(`throw ${exception.pascalName}.NotImplemented;`);
			} else {
				b.line(2)(`throw new Error("Method not implemented.");`);
			}
			b.line(1)(`}`);
		}

		b.line(`}`);

		return b.toString();
	}
}

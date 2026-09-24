import { EXE_NAME, NAME_FLAG_HELP, NEVER_SCHEMAS } from "@/constants";
import { MainFileUpdater } from "@/FileParser/MainFileUpdater";
import { Importable } from "@/Importable";
import { checkNotImplementedExceptionExists } from "@/internal/checkNotImplementedExceptionExists";
import { quote } from "@/internal/converters";
import { parseModelDefinition } from "@/internal/parseModelDefinition";
import { StringBuilder } from "@/internal/StringBuilder";
import { ModuleAbstract } from "@/Modules/ModuleAbstract";
import { assert } from "@/utils/assert";
import { isAbsent } from "@/utils/is";

export class AddControllerModule extends ModuleAbstract {
	constructor(private readonly mainFileUpdater: MainFileUpdater) {
		super();
	}

	override keys: string[] = ["controller", "ctrl"];
	override get help(): string[] {
		return [
			"Scaffold a standalone controller with stubbed CRUD routes.",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the controller to generate.`,
			"",
			"Note: this only generates the controller file. Without a matching",
			"model and service, the stubbed routes will be untyped and just throw.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);

		const controller = new Importable(name, "controller");
		const model = new Importable(name, "model");
		const service = new Importable(name, "service");
		const exception = new Importable(name, "exception");

		this.writeFile(this.buildControllerFile(controller, model, service, exception), [
			controller.filePath,
		]);

		this.mainFileUpdater.addLines(
			"import",
			`import { ${controller.pascalName} } from "${controller.importFrom(this.config.main)}";`,
		);

		this.mainFileUpdater.addLines(
			"controller",
			`new ${controller.pascalName}(${service.exists ? service.camelName : ""});`,
		);
	}

	buildControllerFile(
		controller: Importable,
		model: Importable,
		service: Importable,
		exception: Importable,
	): string {
		if (model.exists && service.exists) {
			return this.buildControllerFileWithModelAndService(controller, model, service);
		}

		if (this.flags.empty) {
			return this.buildEmptyControllerFile(controller);
		}

		return this.buildControllerFileWithDefaults(controller, exception);
	}

	private buildEmptyControllerFile(controller: Importable) {
		const b = new StringBuilder();

		b.line(`import { C } from "${this.config.pkgPath}";`);
		b.line("");
		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor() {`);
		b.line(2)(`super("/${controller.resourceName}");`);
		b.line(1)(`}`);
		b.line(`}`);

		return b.toString();
	}

	private buildControllerFileWithDefaults(controller: Importable, exception: Importable) {
		const b = new StringBuilder();
		const methods = this.config.defaultMethods;
		const notImplementedExceptionExists = checkNotImplementedExceptionExists(exception);

		b.line(`import { C } from "${this.config.pkgPath}";`);
		if (notImplementedExceptionExists) {
			b.line(
				`import { ${exception.pascalName} } from "${exception.importFrom(controller.filePath)}";`,
			);
		}
		b.line("");

		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor() {`);
		b.line(2)(`super("/${controller.resourceName}");`);
		b.line(1)(`}`);

		for (const { propertyKey, address } of Object.values(methods)) {
			b.line("");
			b.line(1)(`${propertyKey} = this.route(${quote(address)}, (c) => {`);
			if (notImplementedExceptionExists) {
				b.inline(`${exception.pascalName}.NotImplemented();`);
			} else {
				b.inline(`throw new Error("Method not implemented.");`);
			}
			b.inline(`});`);
		}
		b.line(`}`);

		return b.toString();
	}

	buildControllerFileWithModelAndService(
		controller: Importable,
		model: Importable,
		service: Importable,
	) {
		const b = new StringBuilder();
		const { modelName, modelTypeName, modelDef } = parseModelDefinition(model);

		const noValLib = isAbsent(this.config.validationLibrary);

		b.line(`import { C } from "${this.config.pkgPath}";`);

		b.line(
			`import ${noValLib ? "type " : ""}{ ${noValLib ? modelTypeName : modelName} } from "${model.importFrom(controller.filePath)}";`,
		);
		b.line(`import { ${service.pascalName} } from "${service.importFrom(controller.filePath)}";`);

		b.line("");
		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor(private readonly service: ${service.pascalName}) {`);
		b.line(2)(`super("/${controller.resourceName}");`);
		b.line(1)(`}`);

		for (const [key, val] of Object.entries(modelDef)) {
			const ORDER = ["body", "search", "params", "response"] as const;
			const callArgOrder = ["search", "params", "body"] as const;
			const callArgs = callArgOrder
				.filter((k) => k in val && !this.isNeverSchema(val[k]!))
				.map((k) => `c.${k}`)
				.join(", ");

			const generics = noValLib
				? `<${ORDER.map((acc) => `\n\t\t${modelTypeName}["${key}"]["${acc}"]`).join(",")}\n\t>`
				: "";
			const address = this.resolveAddress(val);
			const baseArgs = `${quote(address)}, (c) => this.service.${key}(${callArgs})`;
			const validatorArg = noValLib ? "" : `, ${modelName}.${key}`;

			b.line("");
			b.line(1)(`${key} = this.route${generics}(${baseArgs}${validatorArg});`);
		}

		b.line(`}`);

		return b.toString();
	}

	private isNeverSchema = (schema: string) => NEVER_SCHEMAS.has(schema.trim());

	private hasSchema(model: Record<string, string>, key: string) {
		return key in model && typeof model[key] === "string" && !NEVER_SCHEMAS.has(model[key].trim());
	}

	private resolveAddress(model: Record<string, string>) {
		let method = "GET";
		let endpoint = "/";

		const hasBody = this.hasSchema(model, "body");
		const hasParams = this.hasSchema(model, "params");

		if (hasBody && hasParams) {
			// body AND params is most likely PUT
			method = "PUT";
		} else if (hasBody && !hasParams) {
			// if body exists without params, the method is most likely POST
			method = "POST";
		} else if (!hasBody && hasParams) {
			// params without body is most likely DELETE
			method = "DELETE";
		}

		if (hasParams && typeof model.params === "string") {
			// this is an arktype/zod/yup schema or an interface property
			// the keys should be extracted from it to construct an address
			// example output: "GET /:id/:param"
			const keys = this.extractParamKeys(model.params);
			if (keys.length > 0) {
				endpoint = "/" + keys.map((k) => `:${k}`).join("/");
			}
		}

		return `${method} ${endpoint}`;
	}

	private extractParamKeys(paramsStr: string): string[] {
		// matches: key: "value" / key: 'value' / key: value  (unquoted or quoted keys)
		const keyRegex = /["']?([A-Za-z_$][A-Za-z0-9_$]*)["']?\s*:/g;
		const keys: string[] = [];
		let match: RegExpExecArray | null;
		while ((match = keyRegex.exec(paramsStr)) !== null) {
			if (!isAbsent(match[1])) keys.push(match[1]);
		}
		return keys;
	}
}

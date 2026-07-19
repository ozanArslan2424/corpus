import fs from "fs";

import { Importable } from "@/classes/Importable";
import { MainFileUpdater } from "@/classes/MainFileUpdater";
import type { DefaultMethodsConfig } from "@/config/Config";
import { EXE_NAME, NAME_FLAG_HELP, NEVER_SCHEMAS } from "@/constants";
import { parseModelDefinition } from "@/functions/parseModelDefinition";
import { assert } from "@/utils/assert";
import { isNil, isString } from "@/utils/is";
import { ModuleAbstract } from "@/utils/ModuleAbstract";
import { objGetEntries, objGetValues } from "@/utils/objects";
import { StringBuilder } from "@/utils/StringBuilder";
import { quote } from "@/utils/strings";

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

		this.writeFile(this.buildControllerFile(controller, model, service), [controller.filePath]);

		this.mainFileUpdater.addLines(
			"import",
			`import { ${controller.pascalName} } from "${controller.importFrom(this.config.main)}";`,
		);
		this.mainFileUpdater.addLines(
			"controller",
			`new ${controller.pascalName}(${service.camelName});`,
		);
	}

	buildControllerFile(controller: Importable, model: Importable, service: Importable): string {
		const modelExists = fs.existsSync(model.filePath);
		const serviceExists = fs.existsSync(service.filePath);

		if (modelExists && serviceExists) {
			return this.buildControllerFileWithModel(controller, model, service);
		}

		if (this.flags.empty) {
			return this.buildEmptyControllerFile(controller);
		}

		return this.buildControllerFileWithDefaults(controller);
	}

	private buildEmptyControllerFile(controller: Importable) {
		const b = new StringBuilder();

		b.line(`import { C } from "${this.config.pkgPath}";`);
		b.line("");
		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor(private readonly service: unknown) {`);
		b.line(2)(`super();`);
		b.line(1)(`}`);
		b.line("");
		b.line(1)(`override prefix = "/${controller.resourceName}";`);
		b.line(`}`);

		return b.toString();
	}

	private buildControllerFileWithDefaults(controller: Importable) {
		const b = new StringBuilder();
		const methods = this.config.defaultMethods;

		b.line(`import { C } from "${this.config.pkgPath}";`);
		b.line("");
		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor(private readonly service: unknown) {`);
		b.line(2)(`super();`);
		b.line(1)(`}`);
		b.line("");
		b.line(1)(`override prefix = "/${controller.resourceName}";`);

		for (const { propertyKey, address } of objGetValues(methods)) {
			b.line("");
			b.line(1)(
				`${propertyKey} = this.route(${quote(address)}, (c) => { throw new Error("Method not implemented."); });`,
			);
		}

		b.line(`}`);

		return b.toString();
	}

	buildControllerFileWithModel(controller: Importable, model: Importable, service: Importable) {
		const b = new StringBuilder();
		const { modelName, modelTypeName, modelDef } = parseModelDefinition(model);

		const noValLib = isNil(this.config.validationLibrary);

		b.line(`import { C } from "${this.config.pkgPath}";`);

		b.line(
			`import ${noValLib ? "type " : ""}{ ${noValLib ? modelTypeName : modelName} } from "${model.importFrom(controller.filePath)}";`,
		);
		b.line(`import { ${service.pascalName} } from "${service.importFrom(controller.filePath)}";`);

		b.line("");
		b.line(`export class ${controller.pascalName} extends C.Controller {`);
		b.line(1)(`constructor(private readonly service: ${service.pascalName}) {`);
		b.line(2)(`super();`);
		b.line(1)(`}`);
		b.line("");
		b.line(1)(`override prefix = "/${controller.resourceName}";`);

		for (const [key, val] of objGetEntries(modelDef)) {
			const ORDER = ["body", "search", "params", "response"] as const;
			const callArgOrder = ["search", "params", "body"] as const;
			const callArgs = callArgOrder
				.filter((k) => k in val && !this.isNeverSchema(val[k]!))
				.map((k) => `c.${k}`)
				.join(", ");

			const generics = noValLib
				? `<${ORDER.map((acc) => `\n\t\t${modelTypeName}["${key}"]["${acc}"]`).join(",")}\n\t>`
				: "";
			const address = this.resolveAddress(key, val);
			const baseArgs = `${quote(address)}, (c) => this.service.${key}(${callArgs})`;
			const validatorArg = noValLib ? "" : `, ${modelName}.${key}`;

			b.line("");
			b.line(1)(`${key} = this.route${generics}(${baseArgs}${validatorArg});`);
		}

		b.line(`}`);

		return b.toString();
	}

	private isNeverSchema = (schema: string) => NEVER_SCHEMAS.has(schema.trim());

	private resolveAddress(key: string, val: Record<string, string>) {
		const ms = this.config.defaultMethods;

		if (key in ms && !isNil(ms[key as keyof DefaultMethodsConfig])) {
			// if the key is in the default methods, just use that
			// consumer can manually update it if wrong
			return ms[key as keyof DefaultMethodsConfig].address;
		}

		let method = "GET";
		let endpoint = "/";

		const hasBody = "body" in val && isString(val.body) && !this.isNeverSchema(val.body);
		const hasParams = "params" in val && isString(val.params) && !this.isNeverSchema(val.params);

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

		if (hasParams && isString(val.params)) {
			// this is an arktype/zod/yup schema or an interface property
			// the keys should be extracted from it to construct an address
			// example output: "GET /:id/:param"
			const keys = this.extractParamKeys(val.params);
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
			if (!isNil(match[1])) keys.push(match[1]);
		}
		return keys;
	}
}

import { EXE_NAME, NAME_FLAG_HELP } from "@/constants";
import { MainFileUpdater } from "@/FileParser/MainFileUpdater";
import { Importable } from "@/Importable";
import { StringBuilder } from "@/internal/StringBuilder";
import { ModuleAbstract } from "@/Modules/ModuleAbstract";
import { assert } from "@/utils/assert";

export class AddMiddlewareModule extends ModuleAbstract {
	constructor(private readonly mainFileUpdater: MainFileUpdater) {
		super();
	}

	override keys: string[] = ["middleware", "mw"];
	override get help(): string[] {
		return [
			"Scaffold a standalone middleware that calls next.",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the middleware to generate.`,
			"",
			"Note: this only generates the middleware file without a real handler.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);

		const middleware = new Importable(name, "middleware");
		const service = new Importable(name, "service");

		this.writeFile(this.buildMiddlewareFile(middleware, service), [middleware.filePath]);

		this.mainFileUpdater.addLines(
			"import",
			`import { ${middleware.pascalName} } from "${middleware.importFrom(this.config.main)}";`,
		);
		this.mainFileUpdater.addLines(
			"middleware",
			`new ${middleware.pascalName}(${service.exists ? service.camelName : ""});`,
		);
	}

	buildMiddlewareFile(middleware: Importable, service: Importable): string {
		if (service.exists) {
			return this.buildMiddlewareFileWithService(middleware, service);
		}

		return this.buildEmptyMiddlewareFile(middleware);
	}

	private buildEmptyMiddlewareFile(middleware: Importable) {
		const b = new StringBuilder();

		b.line(`import { C } from "${this.config.pkgPath}";`);

		b.line("");
		b.line(`export class ${middleware.pascalName} extends C.Middleware {`);
		b.line(1)(`override useOn: C.MiddlewareUseOn = "*";`);
		b.line(``);
		b.line(1)(`override handler: C.MiddlewareHandler = async (_, next) => {`);
		b.line(2)(`await next();`);
		b.line(1)(`}`);
		b.line(`}`);

		return b.toString();
	}

	buildMiddlewareFileWithService(middleware: Importable, service: Importable) {
		const b = new StringBuilder();

		b.line(`import { C } from "${this.config.pkgPath}";`);
		b.line(`import { ${service.pascalName} } from "${service.importFrom(middleware.filePath)}";`);

		b.line("");
		b.line(`export class ${middleware.pascalName} extends C.Middleware {`);
		b.line(1)(`constructor(private readonly service: ${service.pascalName}) {`);
		b.line(2)(`super();`);
		b.line(2)(`this.register();`);
		b.line(1)(`}`);
		b.line(``);
		b.line(1)(`override useOn: C.MiddlewareUseOn = "*";`);
		b.line(``);
		b.line(1)(`override handler: C.MiddlewareHandler = async (_, next) => {`);
		b.line(2)(`await next();`);
		b.line(1)(`}`);
		b.line(`}`);

		return b.toString();
	}
}

import { assert, StringBuilder, quote } from "@ozanarslan/corpus/utils";

import { Importable } from "@/classes/Importable";
import { EXE_NAME, NAME_FLAG_HELP } from "@/constants";
import { ModuleAbstract } from "@/modules/ModuleAbstract";

export class AddExceptionModule extends ModuleAbstract {
	override keys: string[] = ["exception", "exc"];
	override get help(): string[] {
		return [
			"Scaffold a standalone exception class with a default NotImplemented exception.",
			"",
			`Usage: ${EXE_NAME} ${this.keys.join("|")} ${NAME_FLAG_HELP}`,
			"",
			"Options:",
			`  ${NAME_FLAG_HELP}   Name of the exception class to generate.`,
			"  --empty             Generate a bare exception class with no default exceptions.",
			"",
			"Note: this only generates the exception file and does not touch any other files.",
		];
	}

	override main(): void | Promise<void> {
		const name = this.flags.name;
		assert(name, `name is required.\n\t${EXE_NAME} ${this.passedKey} ${NAME_FLAG_HELP}`);

		const exception = new Importable(name, "exception");

		this.writeFile(this.buildExceptionFile(exception), [exception.filePath]);
	}

	buildExceptionFile(exception: Importable): string {
		if (this.flags.empty) {
			return this.buildEmptyExceptionFile(exception);
		}

		return this.buildExceptionFileWithDefaults(exception);
	}

	private buildEmptyExceptionFile(exception: Importable) {
		const b = new StringBuilder();

		b.line(`export class ${exception.pascalName} {`);
		b.line(`}`);

		return b.toString();
	}

	private buildExceptionFileWithDefaults(exception: Importable) {
		const b = new StringBuilder();

		b.line(`import { C } from ${quote(this.config.pkgPath)};`);
		b.line("");
		b.line(`export class ${exception.pascalName} {`);
		b.line(1)(
			`static NotImplemented = new C.Exception("NotImplemented", C.Status.INTERNAL_SERVER_ERROR);`,
		);
		b.line(`}`);

		return b.toString();
	}
}

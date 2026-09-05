import fs from "fs";

import type { Importable } from "@/classes/Importable";

export function checkNotImplementedExceptionExists(exception: Importable) {
	let notImplementedExceptionExists = false;

	if (fs.existsSync(exception.filePath)) {
		exception.parseFile((node) => {
			if (node.type === "ClassDeclaration") {
				for (const member of node.body.body) {
					if (
						(member.type === "PropertyDefinition" || member.type === "MethodDefinition") &&
						member.key.type === "Identifier" &&
						member.key.name === "NotImplemented"
					) {
						notImplementedExceptionExists = true;
					}
				}
			} else if (node.type === "VariableDeclaration") {
				for (const decl of node.declarations) {
					if (decl.init?.type !== "ObjectExpression") continue;
					for (const prop of decl.init.properties) {
						if (
							prop.type === "Property" &&
							prop.key.type === "Identifier" &&
							prop.key.name === "NotImplemented"
						) {
							notImplementedExceptionExists = true;
						}
					}
				}
			}
		});
	}

	return notImplementedExceptionExists;
}

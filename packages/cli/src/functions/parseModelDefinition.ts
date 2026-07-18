import type { Importable } from "@/classes/Importable";
import { INTERFACE_MODEL_PATTERN, MODEL_PATTERN, MODEL_TYPE_PATTERN } from "@/constants";

export function parseModelDefinition(model: Importable) {
	let modelName = "";
	let modelTypeName = "";
	const modelDef: Record<string, Record<string, string>> = {};

	model.parseFile((node, reader, str) => {
		const firstLn = reader.useBetween(node.start, node.end).useUntil("\n");
		const isModel = firstLn.contains(MODEL_PATTERN);
		if (isModel) {
			if (node.type === "ClassDeclaration") {
				// model that's class
				modelName = node.id?.name ?? "";
				for (const member of node.body.body) {
					if (member.type === "MethodDefinition" && member.static && member.kind === "get") {
						const returns = member.value.body?.body.find((b) => b.type === "ReturnStatement");
						if (returns?.argument?.type !== "ObjectExpression") continue;
						modelDef[str(member.key)] = {};
						for (const prop of returns.argument.properties) {
							if (prop.type === "SpreadElement") continue;
							if (prop.value) modelDef[str(member.key)]![str(prop.key)] = str(prop.value);
						}
					} else if (member.type === "PropertyDefinition" && member.static) {
						if (member.value?.type !== "ObjectExpression") continue;
						modelDef[str(member.key)] = {};
						for (const prop of member.value.properties) {
							if (prop.type === "SpreadElement") continue;
							if (prop.value) modelDef[str(member.key)]![str(prop.key)] = str(prop.value);
						}
					}
				}
			} else if (node.type === "VariableDeclaration") {
				// model that's object
				const decl = node.declarations.find((decl) => decl.init?.type === "ObjectExpression");
				if (decl?.id.type === "Identifier") modelName = decl.id.name;
				const obj = decl?.init;
				if (!obj || obj.type !== "ObjectExpression") return;
				for (const prop of obj.properties) {
					if (prop.type === "SpreadElement") continue;
					if (prop.value?.type !== "ObjectExpression") continue;
					modelDef[str(prop.key)] = {};
					for (const prop2 of prop.value.properties) {
						if (prop2.type === "SpreadElement") continue;
						if (prop2.value) modelDef[str(prop.key)]![str(prop2.key)] = str(prop2.value);
					}
				}
			}
		}

		// if the model actually exists, search for inferred type
		const isModelType = firstLn.contains(MODEL_TYPE_PATTERN);
		if (isModelType) modelTypeName = firstLn.toString().match(MODEL_TYPE_PATTERN)?.[1] ?? "";

		// if there is an interface probably no validation library
		if (node.type === "TSInterfaceDeclaration") {
			const match = firstLn.toString().match(INTERFACE_MODEL_PATTERN);
			if (match?.[1]) {
				modelTypeName = match[1];
				for (const member of node.body.body) {
					if (member.type !== "TSPropertySignature") continue;
					if (!member.typeAnnotation) continue;
					const key = str(member.key);
					const typeNode = member.typeAnnotation.typeAnnotation;
					if (typeNode.type !== "TSTypeLiteral") continue;
					modelDef[key] = {};
					for (const inner of typeNode.members) {
						if (inner.type !== "TSPropertySignature") continue;
						if (!inner.typeAnnotation) continue;
						const innerKey = str(inner.key);
						modelDef[key]![innerKey] = str(inner.typeAnnotation.typeAnnotation);
					}
				}
			}
		}
	});

	return {
		modelName,
		modelTypeName,
		modelDef,
	};
}

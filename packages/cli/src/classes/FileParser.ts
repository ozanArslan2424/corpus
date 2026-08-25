import fs from "fs";

import { objGetValues, StringReader } from "@ozanarslan/utils";
import { parseSync, type Node, type Program } from "oxc-parser";

export type FileParserCallback = (
	node: Node,
	reader: StringReader,
	str: (node: Node) => string,
) => void | FileParserCallback;

export class FileParser {
	constructor(readonly filePath: string) {
		this.contents = fs.readFileSync(this.filePath, "utf8");
		this.reader = new StringReader(this.contents);
		this.program = this.getProgram();
	}
	private readonly reader: StringReader;
	private contents: string;
	private program: Program;

	getProgram() {
		const { program, errors } = parseSync(this.filePath, this.contents, { sourceType: "module" });
		if (errors.length > 0) {
			console.error("Parse errors:");
			for (const err of errors) {
				console.error(err);
			}
			process.exit(1);
		}
		return program;
	}

	runCallback(cb: FileParserCallback) {
		this.handleNode(this.program, cb);
	}

	private handleNode(input: unknown, cb: FileParserCallback) {
		// duck typing required
		if (typeof input !== "object") return;
		if (input === null) return;
		if (!("start" in input)) return;
		if (typeof input.start !== "number") return;
		if (!("end" in input)) return;
		if (typeof input.end !== "number") return;
		if (!("type" in input)) return;
		if (typeof input.type !== "string") return;

		// type casting after duck typing
		const node = input as Node;

		// run the callback; if it returns a new callback, thread that
		// into the recursive calls instead of the original
		const result = cb(node, this.reader, (node) => this.reader.getBetween(node.start, node.end));
		const nextCb = typeof result === "function" ? result : cb;

		// if declared and exported just use the declaration type
		if (node.type === "ExportDefaultDeclaration" || node.type === "ExportNamedDeclaration") {
			if (node.declaration?.type)
				node.type = node.declaration?.type as "ExportDefaultDeclaration" | "ExportNamedDeclaration";
		}

		// recurse
		for (const inner of objGetValues(node)) {
			if (Array.isArray(inner)) {
				for (const ii of inner) {
					this.handleNode(ii, nextCb);
				}
			} else {
				this.handleNode(inner, nextCb);
			}
		}
	}
}

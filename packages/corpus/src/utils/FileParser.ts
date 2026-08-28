import fs from "fs";

import { parseSync, type Node, type Program } from "oxc-parser";

import { isUndefined } from "@/utils/maybe";
import { objGetValues } from "@/utils/object";
import { StringReader } from "@/utils/StringReader";

export type FileParserCallback<N extends Node> = (
	node: N,
	reader: StringReader,
) => void | FileParserCallback<Node>;

export class FileParser {
	constructor(readonly filePath: string) {
		this.reload();
	}

	reload() {
		this._contents = this.initFileContent();
		this._reader = this.initReader();
		this._program = this.initProgram();
	}

	private initFileContent() {
		return fs.readFileSync(this.filePath, "utf8");
	}

	private initReader() {
		return new StringReader(this.contents);
	}

	private initProgram() {
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

	private _reader: StringReader | undefined;
	public get reader(): StringReader {
		if (isUndefined(this._reader)) this._reader = this.initReader();
		return this._reader;
	}

	private _contents: string | undefined;
	public get contents(): string {
		if (isUndefined(this._contents)) this._contents = this.initFileContent();
		return this._contents;
	}

	private _program: Program | undefined;
	public get program(): Program {
		if (isUndefined(this._program)) this._program = this.initProgram();
		return this._program;
	}

	flushReader() {
		fs.writeFileSync(this.filePath, this.reader.toString());
		this.reload();
	}

	getNodeTextContent(node: Node) {
		return this.reader.getBetween(node.start, node.end);
	}

	runCallbackOn<N extends Node>(node: N, cb: FileParserCallback<N>) {
		this.handleNode(node, cb);
	}

	runCallback<N extends Node>(cb: FileParserCallback<N>) {
		this.handleNode(this.program, cb);
	}

	private handleNode<N extends Node>(input: unknown, cb: FileParserCallback<N>) {
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
		const node = input as N;

		// run the callback; if it returns a new callback, thread that
		// into the recursive calls instead of the original
		const result = cb(node, this.reader);
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

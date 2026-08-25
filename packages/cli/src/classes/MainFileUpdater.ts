import fs from "fs";

import {
	isSomeArray,
	logger,
	isEmpty,
	isNull,
	objGetKeys,
	objGetEntries,
	StringReader,
} from "@ozanarslan/utils";
import type { Node } from "oxc-parser";

import { FileParser } from "@/classes/FileParser";
import { getConfig } from "@/config/getConfig";
import { LISTEN_PATTERN, PATTERNS } from "@/constants";

type ChunkKind = "import" | "route" | "middleware" | "controller" | "service";

type Chunk = {
	kind: ChunkKind;
	text: string;
	start: number;
	end: number;
};

type Place = { at: "above" | "below"; kind: ChunkKind };

const above = (kind: ChunkKind): Place => ({ at: "above", kind });
const below = (kind: ChunkKind): Place => ({ at: "below", kind });

const PLACES_BY_KIND: Record<ChunkKind, Place[]> = {
	import: [above("import")], // FALLBACK: top
	route: [below("route"), above("controller"), above("middleware"), below("service")], // FALLBACK: listen
	middleware: [below("middleware"), below("controller"), below("route"), below("service")], // FALLBACK: listen
	controller: [below("controller"), below("route"), above("middleware"), below("service")], // FALLBACK: listen
	service: [below("service"), above("controller"), above("route"), above("middleware")], // FALLBACK: listen
};

export class MainFileUpdater {
	constructor() {
		this.filePath = getConfig().main;
	}

	readonly filePath: string;
	private readonly set = new Set<Chunk>();
	private reader!: StringReader;

	private reload() {
		this.set.clear();
		const fileParser = new FileParser(this.filePath);
		fileParser.runCallback((node, reader) => {
			this.reader = reader;
			this.processNode(node);
		});
	}

	flush() {
		fs.writeFileSync(this.filePath, this.reader.toString());
		this.reload();
	}

	addLines(kind: ChunkKind, ...lines: string[]) {
		this.reload();

		lines = lines.filter((line) => {
			const match = this.reader.getLine(line.trim());
			const pass = isEmpty(match);
			if (!pass) logger.warn(`Skipping existing line: ${line}`);
			return pass;
		});

		if (!isSomeArray(lines)) return;

		const place = this.getPlace(kind);
		if (place.at === "below") {
			this.reader.addBelowLine(place.line, lines.join("\n"));
		} else {
			this.reader.addAboveLine(place.line, lines.join("\n"));
		}

		this.flush();
	}

	getKind(line: string): ChunkKind | null {
		for (const kind of objGetKeys(PATTERNS)) {
			if (PATTERNS[kind].test(line)) return kind;
		}
		return null;
	}

	getPlace(kind: ChunkKind): { at: Place["at"]; line: number } {
		const places = PLACES_BY_KIND[kind];
		let index: number | null = null;
		let at: Place["at"] = "below";
		let i = 0;
		while (isNull(index) && i < places.length) {
			const place = places[i];
			if (place) {
				at = place.at;
				if (place.at === "below") {
					index = this.getChunkEnd(place.kind);
				} else {
					index = this.getChunkStart(place.kind);
				}
			}
			i++;
		}

		if (!isNull(index)) {
			return { at, line: this.reader.getLineNumberOfCharIndex(index) };
		}

		if (kind === "import") {
			// FALLBACK: top
			return { at: "above", line: 0 };
		}

		// FALLBACK: listen
		return { at: "above", line: this.reader.getLineNumber(LISTEN_PATTERN) };
	}

	getChunkStart(kind: ChunkKind) {
		const vals = Array.from(this.set)
			.filter((it) => it.kind === kind)
			.map((it) => it.start);
		if (!isSomeArray(vals)) return null;
		return Math.min(...vals);
	}

	getChunkEnd(kind: ChunkKind) {
		const vals = Array.from(this.set)
			.filter((it) => it.kind === kind)
			.map((it) => it.end);
		if (!isSomeArray(vals)) return null;
		return Math.max(...vals);
	}

	private processNode(node: Node) {
		switch (node.type) {
			case "ImportDeclaration":
				this.set.add({
					kind: "import",
					text: this.reader.getBetween(node.start, node.end),
					start: node.start,
					end: node.end,
				});
				break;

			case "ExpressionStatement":
			case "VariableDeclaration":
				for (const [kind, pattern] of objGetEntries(PATTERNS)) {
					if (kind === "import") continue;
					const content = this.reader.useBetween(node.start, node.end);
					if (content.useLine(0).contains(pattern)) {
						this.set.add({
							kind: kind,
							text: content.toString(),
							start: node.start,
							end: node.end,
						});
					}
				}
				break;
		}
	}
}

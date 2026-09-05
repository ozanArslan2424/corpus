#!/usr/bin/env bun

import { logFatal } from "@ozanarslan/corpus/utils";

import { MainFileUpdater } from "@/classes/MainFileUpdater";
import { APP_NAME, EXE_NAME } from "@/constants";
import { AddControllerModule } from "@/modules/AddControllerModule";
import { AddExceptionModule } from "@/modules/AddExceptionModule";
import { AddModelModule } from "@/modules/AddModelModule";
import { AddResourceModule } from "@/modules/AddResourceModule";
import { AddServiceModule } from "@/modules/AddServiceModule";
import { ApiClientModule } from "@/modules/ApiClientModule";

const mainFileUpdater = new MainFileUpdater();

const apiClientModule = new ApiClientModule();
const addServiceModule = new AddServiceModule(mainFileUpdater);
const addControllerModule = new AddControllerModule(mainFileUpdater);
const addModelModule = new AddModelModule();
const addExceptionModule = new AddExceptionModule();
const addResourceModule = new AddResourceModule(
	mainFileUpdater,
	addModelModule,
	addExceptionModule,
	addServiceModule,
	addControllerModule,
);

const mods = [
	apiClientModule,
	addServiceModule,
	addControllerModule,
	addModelModule,
	addExceptionModule,
	addResourceModule,
];

function printHelp() {
	const pad = Math.max(...mods.map((m) => m.keys.join(", ").length)) + 2;
	process.stdout.write(
		[
			`${EXE_NAME} — ${APP_NAME} Corpus codegen tool.`,
			"",
			"Usage:",
			`  ${EXE_NAME} <module> [args]`,
			"",
			"modules:",
			...mods.map((m) => `  ${m.keys.join(", ").padEnd(pad)}${m.help[0]}`),
			"",
			`Run \`${EXE_NAME} <module> --help\` for module-specific flags.`,
			"",
		].join("\n"),
	);
}

const argv = process.argv.slice(2);
const first = argv[0];
if (!first || first === "-h" || first === "--help") {
	printHelp();
	process.exit(first ? 0 : 1);
}

const mod = mods.find((m) => m.keys.includes(first));
if (!mod) {
	printHelp();
	process.exit(1);
}

try {
	await mod.run();
} catch (err) {
	await mod.stop();
	logFatal(err);
} finally {
	await mod.stop();
	process.exit(0);
}

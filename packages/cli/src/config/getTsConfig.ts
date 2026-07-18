import fs from "fs";

import { logger } from "@/utils/logger";
import { resolveCwdPath } from "@/utils/paths";
import type { Nullable } from "@/utils/types";

export type PartialTsConfig = Partial<{
	compilerOptions: Partial<{
		paths: Record<string, Array<string>>;
	}>;
}>;

export function getTsConfig(): Nullable<PartialTsConfig> {
	const tsconfigPath = resolveCwdPath("tsconfig.json");
	if (!fs.existsSync(tsconfigPath)) {
		logger.log(`No tsconfig.json found.`);
		return null;
	}
	const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
	return tsconfig;
}

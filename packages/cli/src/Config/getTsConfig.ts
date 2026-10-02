import fs from "fs";

import { resolveCwdPath } from "@/internal/resolveCwdPath";
import type { Nullable } from "@/utils/is";
import { logger } from "@/utils/logger";

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
	const tsconfig = Bun.JSONC.parse(fs.readFileSync(tsconfigPath, "utf-8"));
	return tsconfig as PartialTsConfig;
}

import { objMerge, type DeepPartial } from "@ozanarslan/corpus/utils";

import type { Config } from "@/Config/Config";
import { getDefaultConfig } from "@/Config/getConfig";

export function defineConfig(config: DeepPartial<Config>): Config {
	return objMerge(getDefaultConfig(), config as Partial<Config>);
}

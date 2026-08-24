import { objMerge } from "@ozanarslan/utils/object";
import type { DeepPartial } from "@ozanarslan/utils/types";

import type { Config } from "@/config/Config";
import { getDefaultConfig } from "@/config/getConfig";

export function defineConfig(config: DeepPartial<Config>): Config {
	return objMerge(getDefaultConfig(), config as Partial<Config>);
}

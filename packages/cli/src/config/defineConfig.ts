import type { Config } from "@/config/Config";
import { getDefaultConfig } from "@/config/getConfig";
import { objMerge } from "@/utils/objects";
import type { DeepPartial } from "@/utils/types";

export function defineConfig(config: DeepPartial<Config>): Config {
	return objMerge(getDefaultConfig(), config as Partial<Config>);
}

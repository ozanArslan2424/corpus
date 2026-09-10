import type { Config } from "@/Config/Config";
import { getDefaultConfig } from "@/Config/getConfig";
import { objMerge } from "@/internal/objMerge";
import type { DeepPartial } from "@/utils/object";

export function defineConfig(config: DeepPartial<Config>): Config {
	return objMerge(getDefaultConfig(), config as Partial<Config>);
}

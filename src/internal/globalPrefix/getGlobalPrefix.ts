import { Config } from "@/internal/Config/Config";
import { globalPrefixEnvKey } from "@/internal/globalPrefix/globalPrefixEnvKey";

export function getGlobalPrefix() {
	return Config.get(globalPrefixEnvKey, { fallback: "" });
}

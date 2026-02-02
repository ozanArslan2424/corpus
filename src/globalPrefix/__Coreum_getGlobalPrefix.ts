import { __Coreum_Config } from "@/Config/__Coreum_Config";
import { __Coreum_globalPrefixEnvKey } from "@/globalPrefix/__Coreum_globalPrefixEnvKey";

export function __Coreum_getGlobalPrefix() {
	return __Coreum_Config.get(__Coreum_globalPrefixEnvKey, { fallback: "" });
}

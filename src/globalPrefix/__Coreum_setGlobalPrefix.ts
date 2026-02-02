import { __Coreum_Config } from "@/Config/__Coreum_Config";
import { __Coreum_globalPrefixEnvKey } from "@/globalPrefix/__Coreum_globalPrefixEnvKey";

export function __Coreum_setGlobalPrefix(value: string) {
	return __Coreum_Config.set(__Coreum_globalPrefixEnvKey, value);
}

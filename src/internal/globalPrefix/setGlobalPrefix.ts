import { Config } from "@/internal/Config/Config";
import { globalPrefixEnvKey } from "@/internal/globalPrefix/globalPrefixEnvKey";

export function setGlobalPrefix(value: string) {
	return Config.set(globalPrefixEnvKey, value);
}

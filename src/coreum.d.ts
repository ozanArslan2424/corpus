import type { EnvInterface } from "@/internal/interfaces/EnvInterface";
import type { JwtPayloadInterface } from "@/internal/interfaces/JwtPayloadInterface";
import type { LoggerInterface } from "@/internal/modules/Logger/LoggerInterface";

declare module "coreum" {
	export interface Env extends EnvInterface {}
	export interface JwtPayload extends JwtPayloadInterface {}
	export interface Logger extends LoggerInterface {}
	export interface DatabaseClientInterface extends DatabaseClientInterface {}
}

export as namespace coreum;

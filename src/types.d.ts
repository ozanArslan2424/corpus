import { EnvInterface as IEnv } from "@/modules/Config/EnvInterface";
import { DatabaseClientInterface as IDatabaseClient } from "@/modules/DatabaseClient/DatabaseClientInterface";

declare module "coreum" {
	export interface Env extends IEnv {}
	export interface DatabaseClientInterface extends IDatabaseClient {}
}

export as namespace coreum;

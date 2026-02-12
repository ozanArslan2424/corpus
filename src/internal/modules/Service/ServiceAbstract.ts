import { makeLogger } from "@/internal/global/LoggerClass";
import type { LoggerInterface } from "@/internal/modules/Logger/LoggerInterface";
import type { ServiceInterface } from "@/internal/modules/Service/ServiceInterface";

export class ServiceAbstract implements ServiceInterface {
	readonly logger: LoggerInterface = makeLogger(this.constructor.name);
}

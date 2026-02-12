import { LoggerAbstract } from "@/internal/modules/Logger/LoggerAbstract";
import type { LoggerInterface } from "@/internal/modules/Logger/LoggerInterface";

export class Logger extends LoggerAbstract implements LoggerInterface {}

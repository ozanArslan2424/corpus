import type { LoggerInterface } from "@/internal/modules/Logger/LoggerInterface";

import { Logger } from "@/internal/modules/Logger/Logger";

export let LoggerClass: new (...args: any[]) => LoggerInterface = Logger;

/* Pass your Logger class or factory to override default. */

export function setLogger<T extends new (...args: any[]) => LoggerInterface>(
	Class: T,
) {
	LoggerClass = Class;
}

export function makeLogger<T extends typeof LoggerClass>(
	...args: ConstructorParameters<T>
): InstanceType<T> {
	return new LoggerClass(...args) as InstanceType<T>;
}

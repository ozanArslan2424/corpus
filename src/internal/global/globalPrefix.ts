let globalPrefix: string = "";

export function getGlobalPrefix(): string {
	return globalPrefix;
}

export function setGlobalPrefix(value: string): void {
	globalPrefix = value;
}

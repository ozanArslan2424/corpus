export function getProcessedValue(value: string): string | boolean | number {
	let processedValue: string | boolean | number = value;

	if (/^-?\d+(\.\d+)?$/.test(value)) {
		processedValue = Number(value);
	} else if (
		value.toLowerCase() === "true" ||
		value.toLowerCase() === "false"
	) {
		processedValue = value.toLowerCase() === "true";
	}

	return processedValue;
}

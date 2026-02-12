export function assert<T>(
	condition: T | null | undefined,
	message?: string,
): asserts condition {
	const conditionName = String(condition);
	if (!condition) {
		if (!message) {
			message = `Assertion failed for ${conditionName}`;
		} else {
			message = `${conditionName}: ${message}`;
		}
		throw new Error(message);
	}
}

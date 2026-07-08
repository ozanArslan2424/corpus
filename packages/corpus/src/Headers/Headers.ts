import type { HeaderKey } from "@/enums/HeaderKey";

const originalAppend = Headers.prototype.append;
const originalSet = Headers.prototype.set;
const originalGet = Headers.prototype.get;
const originalHas = Headers.prototype.has;
const originalDelete = Headers.prototype.delete;

Headers.prototype.append = function (name: HeaderKey, value: string | string[]): void {
	if (Array.isArray(value)) {
		for (const v of value) {
			originalAppend.call(this, name, v);
		}
	} else {
		originalAppend.call(this, name, value);
	}
};

Headers.prototype.set = function (name: HeaderKey, value: string | number | boolean): void {
	originalSet.call(this, name, String(value));
};

Headers.prototype.get = function (name: HeaderKey): string | null {
	return originalGet.call(this, name) ?? originalGet.call(this, name.toLowerCase());
};

Headers.prototype.has = function (name: HeaderKey): boolean {
	return originalHas.call(this, name) || originalHas.call(this, name.toLowerCase());
};

Headers.prototype.delete = function (name: HeaderKey): void {
	return originalDelete.call(this, name);
};

Headers.prototype.setMany = function (
	init: [HeaderKey, string][] | Partial<Record<HeaderKey, string>>,
): void {
	const entries = Array.isArray(init) ? init : Object.entries(init);
	for (const [key, value] of entries) {
		if (!value || !value.trim()) continue;
		originalSet.call(this, key, value);
	}
};

Headers.prototype.mergeWith = function (source: Headers): void {
	source.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") originalAppend.call(this, key, value);
		else originalSet.call(this, key, value);
	});
};

export {};

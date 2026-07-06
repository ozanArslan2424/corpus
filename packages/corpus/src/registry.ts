import { Registry } from "@/Registry/Registry";

let instance: Registry | undefined;

function getInstance(): Registry {
	if (!instance) {
		instance = new Registry();
	}
	return instance;
}

export const $registry = new Proxy({} as Registry, {
	get(_target, prop) {
		const target = getInstance();
		return Reflect.get(target, prop, target);
	},
	set(_target, prop, value) {
		const target = getInstance();
		return Reflect.set(target, prop, value, target);
	},
});

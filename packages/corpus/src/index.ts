import { initialize } from "@/initialize";

// Global augments and registries need to be initialized once
initialize();

// No namespace exports
export * from "./exports";

// Namespaced exports are also exported by name
export * from "./C.namespace";

// Namespaced to C
export * as C from "./C.namespace";

// Namespaced to Corpus
export * as Corpus from "./C.namespace";

import type { DatabaseClientInterface } from "@/types.d.ts";

/** Abstract class for repository implementations */
export abstract class RepositoryAbstract {
	constructor(readonly db: DatabaseClientInterface) {}
}

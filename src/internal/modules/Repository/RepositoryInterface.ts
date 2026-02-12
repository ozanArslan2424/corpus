import type { DatabaseClientInterface } from "@/internal/interfaces/DatabaseClientInterface";

export interface RepositoryInterface {
	readonly db: DatabaseClientInterface;
}

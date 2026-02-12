import type { MaybePromise } from "@/internal/types/MaybePromise";
import type { Endpoint } from "@/internal/types/Endpoint";

export type ControllerOptions<Prefix extends string = string> = {
	prefix?: Endpoint<Prefix>;
	beforeEach?: <D>(data?: D) => MaybePromise<D> | void;
};

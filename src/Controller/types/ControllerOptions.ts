import type { Context } from "@/Context/Context";
import type { MaybePromise } from "@/utils/types/MaybePromise";

export type ControllerOptions = {
	prefix?: string;
	beforeEach?: (context: Context) => MaybePromise<void>;
};

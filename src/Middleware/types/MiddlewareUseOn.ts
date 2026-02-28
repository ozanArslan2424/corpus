import type { ControllerAbstract } from "@/Controller/ControllerAbstract";
import type { AnyRoute } from "../../Route/types/AnyRoute";

export type MiddlewareUseOn =
	| Array<AnyRoute | ControllerAbstract>
	| AnyRoute
	| ControllerAbstract
	| "*";

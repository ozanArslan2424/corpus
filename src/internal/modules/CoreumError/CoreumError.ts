import { Status } from "@/exports";
import { CoreumErrorAbstract } from "@/internal/modules/CoreumError/CoreumErrorAbstract";
import type { CoreumErrorInterface } from "@/internal/modules/CoreumError/CoreumErrorInterface";

export class CoreumError
	extends CoreumErrorAbstract
	implements CoreumErrorInterface
{
	static isStatusOf(err: unknown, status: Status): boolean {
		if (err instanceof CoreumError) {
			return err.status === status;
		}
		// If not CoreumError instance, should be internal
		return Status.INTERNAL_SERVER_ERROR === status;
	}

	static internalServerError(msg?: string): CoreumError {
		const status = Status.INTERNAL_SERVER_ERROR;
		return new CoreumError(msg ?? status.toString(), status);
	}

	static badRequest(msg?: string): CoreumError {
		const status = Status.BAD_REQUEST;
		return new CoreumError(msg ?? status.toString(), status);
	}

	static notFound(msg?: string): CoreumError {
		const status = Status.NOT_FOUND;
		return new CoreumError(msg ?? status.toString(), status);
	}

	static methodNotAllowed(msg?: string): CoreumError {
		const status = Status.METHOD_NOT_ALLOWED;
		return new CoreumError(msg ?? status.toString(), status);
	}
}

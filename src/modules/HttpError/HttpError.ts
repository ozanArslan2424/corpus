import { Status } from "@/modules/HttpResponse/enums/Status";
import { HttpErrorAbstract } from "@/modules/HttpError/HttpErrorAbstract";
import type { HttpErrorInterface } from "@/modules/HttpError/HttpErrorInterface";

export class HttpError extends HttpErrorAbstract implements HttpErrorInterface {
	static isStatusOf(err: unknown, status: Status): boolean {
		if (err instanceof HttpError) {
			return err.status === status;
		}
		// If not HttpError instance, should be internal
		return Status.INTERNAL_SERVER_ERROR === status;
	}

	static internalServerError(msg?: string): HttpError {
		const status = Status.INTERNAL_SERVER_ERROR;
		return new this(msg ?? status.toString(), status);
	}

	static badRequest(msg?: string): HttpError {
		const status = Status.BAD_REQUEST;
		return new this(msg ?? status.toString(), status);
	}

	static notFound(msg?: string): HttpError {
		const status = Status.NOT_FOUND;
		return new this(msg ?? status.toString(), status);
	}

	static methodNotAllowed(msg?: string): HttpError {
		const status = Status.METHOD_NOT_ALLOWED;
		return new this(msg ?? status.toString(), status);
	}

	static unprocessableEntity(msg?: string): HttpError {
		const status = Status.UNPROCESSABLE_ENTITY;
		return new this(msg ?? status.toString(), status);
	}
}

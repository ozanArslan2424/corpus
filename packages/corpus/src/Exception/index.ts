/**
 * Throwing HTTP errors with a status attached.
 *
 * All errors are caught by {@link App.handleError}, whatever their type. What an
 * {@link Exception} adds is the {@link Status} to answer with: it is rendered
 * through {@link Exception.toRes}, message and detail intact, while an ordinary
 * error becomes an opaque {@link Status.INTERNAL_SERVER_ERROR} so an accidental
 * `TypeError` does not leak its message to the client.
 *
 * Throwing one is the intended way to end a request early:
 *
 * ```ts
 * import { Exception, Status } from "@ozanarslan/corpus";
 *
 * if (!user) throw new Exception("User not found", Status.NOT_FOUND);
 * ```
 *
 * Subclass it for errors you raise often, so the status and message live in one
 * place rather than at every throw site.
 *
 * @module Exception
 */

import { Res, Status } from "@/Res";
import { assertDefined } from "@/utils/assert";

/**
 * An error carrying the {@link Status} it should be answered with.
 *
 * Beyond a status, an exception can carry {@link Exception.data} — either
 * arbitrary detail to include in the error body, or a fully formed {@link Res}
 * when the error response needs its own headers or shape.
 */
class Exception extends Error {
	/**
	 * Creates an exception for subclasses, which assign
	 * {@link Exception.message}, {@link Exception.status} and
	 * {@link Exception.data} themselves.
	 */
	constructor();
	/**
	 * Creates an exception to throw from a handler.
	 *
	 * @param message - Human-readable description. It is sent to the client, so
	 * write it for whoever receives the response.
	 * @param status - The {@link Status} to answer with.
	 * @param data - Optional detail attached to the response body under `error`,
	 * such as validation failures. Pass a {@link Res} instead to control the whole
	 * error response — see {@link Exception.toRes}.
	 */
	constructor(message: string, status: Status, data?: unknown);
	constructor(message?: string, status?: Status, data?: unknown) {
		super(message);
		if (new.target !== Exception) return;
		const msg = "Exception must be constructed with (message, status, data?) or extended.";
		assertDefined(message, msg);
		assertDefined(status, msg);
		this.message = message;
		this.status = status;
		this.data = data;
	}

	/** Human-readable description, sent to the client in the error body. */
	override message!: string;

	/** The {@link Status} the response is sent with. */
	status!: Status;

	/**
	 * Optional detail. An arbitrary value is placed under `error` in the response
	 * body; a {@link Res} is used as the response itself.
	 */
	data?: unknown;

	/**
	 * Renders the exception as the response to send.
	 *
	 * When {@link Exception.data} is a {@link Res}, that response is used directly:
	 * its status is overwritten with {@link Exception.status}, the Exception
	 * message gets discarded. Otherwise a fresh {@link Res} is built with the
	 * message and the detail under `error`.
	 *
	 * @returns The {@link Res} for this error. Called by
	 * {@link App.handleError}.
	 */
	toRes(): Res {
		if (this.data instanceof Res) {
			this.data.status = this.status;
			return this.data;
		}
		return new Res({ error: this.data, message: this.message }, { status: this.status });
	}

	/**
	 * Checks the exception's status, by numeric value or by {@link Status} name.
	 *
	 * Useful when catching an exception to branch on what went wrong:
	 *
	 * ```ts
	 * if (err instanceof Exception && err.isStatusOf("NOT_FOUND")) { … }
	 * ```
	 *
	 * @param status - A {@link Status} value or one of its keys.
	 * @returns `true` when {@link Exception.status} matches.
	 */
	isStatusOf(status: Status | keyof typeof Status): boolean {
		return typeof status === "number" ? this.status === status : this.status === Status[status];
	}
}

export { Exception };

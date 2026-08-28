import type { Cookies } from "@/C/Cookies/Cookies";
import { Status } from "@/C/Res/Status";

export abstract class ResAbstract<R = unknown> {
	abstract get response(): Response;

	abstract get body(): BodyInit | R | null | undefined;
	abstract set body(value: BodyInit | R | null | undefined);

	abstract get statusText(): string;
	abstract set statusText(value: string);

	abstract get status(): Status;
	abstract set status(value: Status);

	abstract get headers(): Headers;
	abstract set headers(value: Headers);

	abstract get cookies(): Cookies;
	abstract set cookies(value: Cookies);
}

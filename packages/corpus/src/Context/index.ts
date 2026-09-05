import { Res } from "@/Res";
import type { Server } from "@/Server";
import type { Maybe, MaybePromise } from "@/utils/maybe";
import { createSafeObject } from "@/utils/object";
import { lazy, type Lazy, type LazyMut } from "@/utils/variable";

interface ContextDataInterface {}

type ContextFactory<B = unknown, S = unknown, P = unknown, R = unknown> = (
	request: Request,
	server: Maybe<Server>,
) => Context<B, S, P, R>;

type ContextHandler<B = unknown, S = unknown, P = unknown, R = unknown> = (
	context: Context<B, S, P, R>,
) => MaybePromise<R>;

class Context<B = unknown, S = unknown, P = unknown, R = unknown> {
	constructor(req: Request, server: Maybe<Server>) {
		this.req = req;
		this.server = server;
		this._res = lazy.mut(() => new Res<R>());
		this._url = lazy(() => new URL(this.req.url));
		this.body = createSafeObject<B>();
		this.params = createSafeObject<P>();
		this.search = createSafeObject<S>();
		this.data = createSafeObject<ContextDataInterface>();
	}

	body: B;
	params: P;
	search: S;
	data: ContextDataInterface;

	readonly server: Maybe<Server>;
	readonly req: Request;

	private _res: LazyMut<Res<R>>;
	get res(): Res<R> {
		return this._res();
	}
	set res(value: Res<R>) {
		this._res.set(value);
	}

	private _url: Lazy<URL>;
	get url(): URL {
		return this._url();
	}
}

export type { ContextFactory, ContextHandler, ContextDataInterface };
export { Context };

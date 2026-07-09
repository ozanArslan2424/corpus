# Middleware types

```ts
export const MiddlewareVariant = {
	inbound: "inbound",
	outbound: "outbound",
} as const;

export type MiddlewareVariant = ValueOf<typeof MiddlewareVariant>;

export type MiddlewareHandler = Func<[context: Context], Bun.MaybePromise<void | Res>>;

export type MiddlewareOptions = {
	variant?: MiddlewareVariant;
	useOn?: MiddlewareUseOn;
	handler: MiddlewareHandler;
};

export type MiddlewareUseOn =
	| Array<BaseRoute<any, any, any, any> | Controller | string>
	| BaseRoute<any, any, any, any>
	| Controller
	| "*";
```

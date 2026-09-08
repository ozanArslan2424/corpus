# Req types

```ts
export type ReqInfo = Request | string | Req | URL;

export type ReqInit = Omit<RequestInit, "headers" | "method"> & {
	headers?: HeadersInit;
	method?: Method;
};
```

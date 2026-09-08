# Res

The `Res` class represents an HTTP response with automatic body serialization, cookie handling, and header management. It provides static helpers for common response patterns like redirects, file streaming, and Server-Sent Events.

<section class="table-of-contents">

##### Contents

1. [Usage](#usage)
2. [Constructor Parameters](#constructor-parameters)
3. [Properties](#properties)
4. [Static Methods](#static-methods)
5. [Body Serialization](#body-serialization)

</section>

## Usage

### Basic response

```ts
import { C } from "@ozanarslan/corpus";

new C.Route("/hello", () => {
	return new C.Res("Hello World");
});
```

### With status and headers

```ts
new C.Route("/created", () => {
	return new C.Res(
		{ id: 1 },
		{
			status: C.Status.CREATED,
			headers: { [C.CommonHeaders.Location]: "/items/1" },
		},
	);
});
```

### Setting cookies

The following is the recommended pattern because Res init can also receive another Res instance and typescript doesn't do a great job differentiating an object with a class.

```ts
new C.Route("/login", (c) => {
	c.res.cookies.set({
		name: "session",
		value: "abc123",
		httpOnly: true,
		secure: true,
	});

	return { success: true };
});
```

### Accessing the native response

```ts
const cres = new C.Res("data");
cres.response; // Returns native Web API Response
```

## Constructor Parameters

### data (optional)

`ResBody<R>`

The response body. Automatically serialized based on type. See [Body Serialization](#body-serialization).

### init (optional)

`ResInit | Res`

Response options or another Res to copy from.

```ts
type ResInit = {
	cookies?: CookiesInit;
	headers?: CHeadersInit;
	status?: Status;
	statusText?: string;
};
```

## Properties

| Property   | Type       | Description                              |
| ---------- | ---------- | ---------------------------------------- |
| body       | `BodyInit` | Resolved and serialized body             |
| headers    | `CHeaders` | Response headers                         |
| status     | `Status`   | HTTP status code                         |
| statusText | `string`   | HTTP status text                         |
| cookies    | `Cookies`  | Response cookies                         |
| response   | `Response` | Getter returning native Web API Response |

## Static Methods

### redirect

`static redirect(url: string | URL, init?: ResInit): Res`

Creates a redirect response. Defaults to 302 Found.

```ts
return C.Res.redirect("/new-path");
return C.Res.redirect("/new-path", {
	status: C.Status.MOVED_PERMANENTLY,
});
```

### permanentRedirect

`static permanentRedirect(url: string | URL, init?: Omit<ResInit, "status">): Res`

301 Moved Permanently redirect.

### temporaryRedirect

`static temporaryRedirect(url: string | URL, init?: Omit<ResInit, "status">): Res`

307 Temporary Redirect.

### seeOther

`static seeOther(url: string | URL, init?: Omit<ResInit, "status">): Res`

303 See Other (redirect with GET).

### sse

`static sse(source: SseSource, init?: Omit<ResInit, "status">, retry?: number): Res`

Server-Sent Events stream.

```ts
return C.Res.sse((send) => {
	const interval = setInterval(() => {
		send({ data: { time: Date.now() }, event: "tick" });
	}, 1000);

	return () => clearInterval(interval); // cleanup
});
```

### ndjson

`static ndjson(source: NdjsonSource, init?: Omit<ResInit, "status">): Res`

Newline-delimited JSON stream.

```ts
return C.Res.ndjson((send) => {
	for (const item of largeDataset) {
		send(item);
	}
});
```

### streamFile

`static async streamFile(filePath: string, disposition?: "attachment" | "inline", init?: Omit<ResInit, "status">): Promise<Res<ReadableStream>>`

Stream a file from disk. Uses `Content-Type` from file extension. Defaults to `attachment` disposition.

```ts
return await C.Res.streamFile("assets/video.mp4", "inline");
```

Throws [Exception](/Exception.html) with 404 if file not found.

### file

`static async file(filePath: string, init?: ResInit): Promise<Res<string>>`

Read entire file into memory as string. Sets `Content-Length` header.

```ts
return await C.Res.file("assets/doc.txt");
```

Throws [Exception](/Exception.html) with 404 if file not found.

## Body Serialization

The body is automatically serialized based on its type:

| Type                                                 | Serialization                        | Content-Type                              |
| ---------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `null` / `undefined`                                 | Empty string                         | `text/plain`                              |
| Primitives (`string`, `number`, `boolean`, `bigint`) | `String(data)`                       | `text/plain`                              |
| `Date`                                               | `toISOString()`                      | `text/plain`                              |
| Plain objects / arrays                               | `JSON.stringify()`                   | `application/json`                        |
| `ArrayBuffer`                                        | As-is                                | `application/octet-stream`                |
| `Blob`                                               | As-is                                | Blob's type or `application/octet-stream` |
| `FormData`                                           | As-is                                | `multipart/form-data`                     |
| `URLSearchParams`                                    | As-is                                | `application/x-www-form-urlencoded`       |
| `ReadableStream`                                     | As-is                                | Set manually via headers                  |
| Custom class instances                               | `String(data)` (calls `.toString()`) | `text/plain`                              |

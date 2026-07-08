# Router

The `Router` class is NOT part of the public Corpus API. It's a part of the global registry, Since the registry is _plug & play_, you can reassign it to your own router interface implementation. However, replacing the router is not recommended since it is responsible for registering the entries for the CLI tool (coming soon). The main matching logic is in the [adapter layer](#creating-your-own-adapter) which is separated to fix this exact issue.

Each [Route](/route.html), [StaticRoute](/route-static.html), [WebSocketRoute](/route-websocket.html), [Controller](/controller.html), and [Middleware](/middleware.html) object will register itself into the global router.

The router instance can be accessed through `$registry.router`.

<section class="table-of-contents">

##### Contents

1. [Interface](#interface)
2. [Plug & Play](#plug-and-play)
3. [Router Adapters](#router-adapters)
4. [Creating Your Own Adapter](#creating-your-own-adapter)

</section>

## Interface

```ts
export interface RouterInterface {
	add(route: BaseRoute<any, any, any, any>): void;
	find(req: Req): RouterReturn | null;
	list(): Array<RouterData>;
}
```

## Plug & Play (not recommended)

Even though the router is technically replaceable, the CLI capabilities will not be available unless methods are manually copied into the new router.

```ts
import { $registry } from "@ozanarslan/corpus";
$registry.router = new MyRouter();
```

## Router Adapters

When instantiating a new `Server`, you may optionally provide a supported adapter inside the ServerOptions. Provided adapters are part of the X module.

### BranchAdapter (default)

The default router adapter, based on [@medley/router](https://github.com/medleyjs/router) by [nwoltman (Nathan Woltman)](https://github.com/nwoltman). This is an extremely fast radix-tree router. The original library is CJS only so i had to fork it internally for this package.
(Attributions included.)

### MemoiristAdapter

An alternative adapter layer for [memoirist](https://github.com/SaltyAom/memoirist) by [SaltyAom](https://github.com/SaltyAom). This is the router used in ElysiaJS. Requires the `memoirist` dependency. Also extremely fast. Copy and paste from [Router DIY](/router/diy/memoirist-adapter.html) and replace the registry adapter.

```ts
import { C, $registry } from "@ozanarslan/corpus";
import { MemoiristAdapter } from "./MemoiristAdapter";

$registry.adapter = new MemoiristAdapter();

const server = new C.Server();
```

## Creating Your Own Adapter

You can implement a custom router adapter by satisfying the `RouterAdapterInterface`. The interface and supporting types are exported by name from the package. You can also see the example from the DIY tab.

```ts
import { C, $registry } from "@ozanarslan/corpus";
import type { RouterAdapterInterface, RouterReturn, RouterData } from "@ozanarslan/corpus";

class MyAdapter implements RouterAdapterInterface {
	readonly __brand: string = "MyAdapter";

	add(data: RouterData): void {
		// register a route
	}

	find(req: C.Req): RouterReturn | null {
		// return matched route data, or null if not found
		// You can also throw in here and it will be handled by
		// the Server.handleError method.
	}

	// optionally return all registered routes
	list: Func<[], Array<RouterData>> | undefined;
}

$registry.adapter = new MyAdapter();

const server = new C.Server();
```

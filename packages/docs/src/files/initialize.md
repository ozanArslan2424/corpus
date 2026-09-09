# initialize

One-time framework setup.

`initialize` creates the global registries and installs the `Request`
and `Headers` extensions the rest of corpus assumes are present. It runs when
the package is imported, so nothing normally needs to call it.

<section class="table-of-contents">

##### Contents

1. [initialize](#initialize)

</section>

## initialize

_function_

```ts
export function initialize();
```

Prepares the process for corpus: creates the `AppsRegistry` and
`ParsersRegistry`, then applies [patchGlobalRequest](./Request/index.md#patchglobalrequest) and
[patchGlobalHeaders](./Headers/index.md#patchglobalheaders).

Guarded through `Globals`, so it runs at most once per process however
many times it is called — which matters because the patches wrap the previous
implementation, and applying them twice would layer one wrapper on another.
The flag is set before the work rather than after, so a re-entrant call during
setup is caught too.

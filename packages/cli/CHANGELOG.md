# @ozanarslan/corpus-cli

## 0.1.0

### Minor Changes

- - Add `middleware` as an `ImportableKind` and wire up a new `AddMiddlewareModule` in the CLI.
  - Add nested/scoped resource path support to `Importable`; add `Importable.exists` to replace scattered `fs.existsSync(x.filePath)` checks.

  - `AddControllerModule`: rename `buildControllerFileWithModel` to `buildControllerFileWithModelAndService`; pass the resolved `service` into `new Controller(...)` in the main file only when the service file actually exists; move prefix to `super()` instead of `override prefix` assignment; generate a `NotImplemented()` exception call instead of a generic thrown `Error` when defaults are scaffolded, importing the exception when available.
  - `AddServiceModule`: fix exception `Importable` to use `name` instead of `service.resourceName`; only generate the `C.InferModel<...>` type and import `C` when a validation library is configured, otherwise import the model's own type directly; switch `NotImplemented` usage to the callable form (`Exception.NotImplemented()`).
  - `AddModelModule`: stop emitting the `${modelTypeName}` type alias and `C.InferModel` import from the model file itself — that responsibility moves to the consuming service.
  - `parseModelDefinition`: fall back to `${modelName}Type` when no model type name could be parsed.

## 0.0.4

### Patch Changes

- Rewrite ArkSchemaPrinter constraint stripping and expand test coverage

  - strip: correctly strip two-sided bound expressions (e.g. `8 <= string
<= 72`) by reducing every intersection member through getBaseType,
    not just the sole-member case; drop the previous unstripped
    pass-through of lone constraints.
  - strip: when a union already resolves to a bare "string", swallow
    sibling regex patterns and string literals into it instead of
    listing them separately (e.g. UUID pattern | literal | literal ->
    string).
  - getBaseType: rename from constraintFallback; match a constraint's
    base type via word-boundary check anywhere in the string (not just
    a leading prefix) so two-sided bounds resolve correctly.
  - isTsToken: extend string-literal detection to single-quoted strings,
    not just double-quoted.
  - rewriteGroup: join non-object bracketed groups (tuples, arrays) with
    ", " instead of "; ", matching arktype's actual tuple syntax; keep
    "; " only for `{}` object bodies.
  - sortUnion: dedupe members before sorting.
  - Rename KEEP -> TS_TYPE; extract isStringLiteral/isPattern helpers.
  - test: replace the ad-hoc primitives/tuples/runtime-constraints specs
    with parametrized .in/.out expression tables covering primitives,
    single- and two-sided constraints, dot-suffixed keyword constraints,
    regex patterns, intersections, morphs, nested objects, and unions.

## 0.0.3

### Patch Changes

- Add namespaced model/args exports and tighten type-safety in CLI

- generateApiClient: support config.exportModelsNamespace and
  exportArgsNamespace to emit models under `Models.*` / `Args.*`
  namespaces instead of flat `${Pascal}Model` interfaces; adjust
  indentation and blank-line placement in writeRouteModel/writeBase
  accordingly.

- ArkSchemaPrinter: reduce bare runtime constraints (regex literals,
  `<=`, `%`, `.email`, etc.) to their base TS type instead of passing
  them through unstripped; preserve trailing `[]` array suffixes in
  isTsToken.

- AddExceptionModule/AddServiceModule: turn NotImplemented into a
  callable (`() => never`) that throws, instead of a static thrown
  value, so it can be invoked (`Exception.NotImplemented()`) rather
  than thrown directly.

- Add missing `as Array<...>` casts on Object.keys/Object.entries in
  MainFileUpdater and objMerge for stricter typing.

## 0.0.2

### Patch Changes

- remove incompatible object declaration from utils

## 0.0.1

### Patch Changes

- First release.

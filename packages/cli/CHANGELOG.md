# @ozanarslan/corpus-cli

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

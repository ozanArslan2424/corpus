# CLI

Code-generation commands for scaffolding models, services, controllers, and exceptions, plus a codegen step for API clients.

<section class="table-of-contents">

##### Contents

1. [Install](#install)
2. [Usage](#usage)
3. [Global options](#global-options)
4. [resource](#resource)
5. [model](#model)
6. [service](#service)
7. [controller](#controller)
8. [exception](#exception)
9. [api](#api)
10. [Configuration File](#configuration-file)

</section>

## Install

Requires a matching version of @ozanarslan/corpus to be installed.

```sh
bun add @ozanarslan/corpus-cli
```

## Usage

```sh
corpus <command> <name> | [--name, -n] <name>
```

Every command accepts `-h`/`--help` to print its usage and exit.

## Global options

| Flag              | Alias | Description                                                                                                                                              |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help`          | `-h`  | Print the command's help text and exit.                                                                                                                  |
| `--name <name>`   | `-n`  | Name of the entity to generate. Falls back to the first positional argument if omitted — so `corpus model foo` and `corpus model -n foo` are equivalent. |
| `--main <path>`   | `-m`  | Override the entry file path used for wiring imports and instantiation.                                                                                  |
| `--silent`        | `-s`  | Suppress info logs.                                                                                                                                      |
| `--output <path>` | `-o`  | Override the output directory.                                                                                                                           |
| `--empty`         | `-e`  | Generate a bare file with no default CRUD shape, where supported.                                                                                        |

If a file already exists at the target path, the module logs a warning and skips writing rather than overwriting it.

## resource

```sh
corpus resource <name> | [--name, -n] <name>
corpus res <name> | [--name, -n] <name>
```

Scaffolds a full resource in one pass: model, exception, service, and controller, then wires the service and controller into the entry file.

**Options**

- `--name`/`-n` — required.
- `--empty`/`-e` — generate a bare model with no default CRUD shape (the service and controller are then generated against whatever model shape was actually written).

**Behavior**

- Delegates to `model`, `exception`, `service`, and `controller` generation internally, in that order, so the service and controller are generated against the model that was just written.
- Adds import lines and instantiation lines (`new Service()`, `new Controller(service)`) to the main file via the shared `MainFileUpdater`.

## model

```sh
corpus model <name> | [--name, -n] <name>
corpus mdl <name> | [--name, -n] <name>
```

Scaffolds a standalone model with a default CRUD-shaped interface or validation schema.

**Options**

- `--name`/`-n` — required.
- `--empty`/`-e` — generate a bare model (a single `entity` interface with just an `id`), skipping the default CRUD method shapes.

**Behavior**

- If no validation library is configured, generates a plain `interface` with `get`, `getByParams`, `create`, `update`, and `remove` shapes, each keyed by the configured method property names.
- If a validation library is configured (`zod`, `yup`, or `arktype`), generates a schema class with static properties for `entity` and each CRUD method instead of a plain interface, and exports an inferred type alongside it.
- Does not touch any other file — only writes the model file.

## service

```sh
corpus service <name> | [--name, -n] <name>
corpus svc <name> | [--name, -n] <name>
```

Scaffolds a standalone service with stubbed CRUD methods, and wires it into the entry file.

**Options**

- `--name`/`-n` — required.
- `--empty`/`-e` — generate a bare service with just a constructor, skipping stubbed methods.

**Behavior**

- If a model of the same name already exists, generates one method per model method, each typed against the model's `params`/`search`/`body`/`response` shapes and throwing `Method not implemented.` (or the resource's `NotImplemented` exception, if one exists).
- If no matching model exists and `--empty` isn't set, generates stubbed, untyped methods for each of the configured default CRUD methods.
- Adds an import line and an instantiation line (`const service = new Service();`) to the main file.

## controller

```sh
corpus controller <name> | [--name, -n] <name>
corpus ctrl <name> | [--name, -n] <name>
```

Scaffolds a standalone controller with stubbed CRUD routes, and wires it into the entry file.

**Options**

- `--name`/`-n` — required.
- `--empty`/`-e` — generate a bare controller with just a `prefix`, skipping stubbed routes.

**Behavior**

- If a matching model **and** service both exist, generates one typed route per model method: HTTP method and path are inferred from the model's `body`/`params` shapes (body+params → `PUT`, body only → `POST`, params only → `DELETE`, neither → `GET`), and path params are extracted from the `params` shape's keys (e.g. `GET /:id`).
- If no matching model/service exist and `--empty` isn't set, generates stubbed routes for the configured default CRUD methods, each throwing `Method not implemented.`.
- Adds an import line and an instantiation line (`new Controller(service);`) to the main file.
- Note: generating a controller alone (without a matching model/service) produces untyped routes that just throw — pair it with `model`/`service`, or use `resource` to scaffold all three together.

## exception

```sh
corpus exception <name> | [--name, -n] <name>
corpus exc <name> | [--name, -n] <name>
```

Scaffolds a standalone exception class.

**Options**

- `--name`/`-n` — required.
- `--empty`/`-e` — generate a bare class with no default exceptions.

**Behavior**

- By default, generates a class with a static `NotImplemented` exception (`C.Status.INTERNAL_SERVER_ERROR`), which `service` and `controller` generation will automatically detect and throw instead of a generic `Error`.
- Does not touch any other file.

## api

```sh
corpus api
```

Generates types, model interfaces, and (unless disabled in config) an API client from your app's registered routes.

**Requirements**

- Your entry file must call `.listen()`, either at the top level or inside a single function.

**Behavior**

1. Reads the entry file and locates the `.listen()` call.
2. If `.listen()` is called inside a named function, rewrites the file to ensure that function is actually invoked (`await fn();`).
3. Replaces the `.listen()` call with a generator invocation that reads the nearest app's routes and config, then exits.
4. Transpiles the rewritten file to a temporary `.mjs` file next to the entry file.
5. Runs the temp file in a subprocess (inheriting stdio) to execute the generator.
6. Deletes the temp file afterward, whether or not generation succeeded.

Fails fatally if no `.listen()` call is found, or if the generator subprocess exits non-zero.

## Configuration File

All fields are optional.

```ts
// corpus.config.ts
import { defineConfig } from "@ozanarslan/corpus-cli";

export default defineConfig({
	silent: false,
	main: "./src/main.ts",
	output: "./src/corpus.gen.ts",
	pkgPath: "@ozanarslan/corpus",
	casing: "pascal",
	validationLibrary: null,
	apiClient: {
		disabled: false,
		exportAs: "CorpusApi",
		useStaticClass: false,
	},
	ignoreGlobalPrefix: false,
	defaultMethods: {
		get: { propertyKey: "get", address: "GET /" },
		getByParams: { propertyKey: "getByParams", address: "GET /:id" },
		create: { propertyKey: "create", address: "POST /" },
		update: { propertyKey: "update", address: "PUT /:id" },
		remove: { propertyKey: "remove", address: "DELETE /:id" },
	},
	folderStructure: {
		model: "{resource}/{resource}-model.ts",
		service: "{resource}/{resource}-service.ts",
		controller: "{resource}/{resource}-controller.ts",
		route: "{resource}/{resource}-route.ts",
	},
	exportModelsNamespace: true,
	exportArgsNamespace: true,
});
```

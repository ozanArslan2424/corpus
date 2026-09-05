# @ozanarslan/corpus-cli

CLI for [@ozanarslan/corpus](https://github.com/ozanArslan2424/corpus) — codegen for API clients, and scaffolding for services, controllers, models, exceptions, and full resources.

## Usage

```bash
bunx @ozanarslan/corpus-cli <module> [args]
```

Or install as a dev dependency:

```bash
bun add -d @ozanarslan/corpus-cli
```

```json
{
	"scripts": {
		"gen:api": "corpus api",
		"gen:resource": "corpus resource"
	}
}
```

## Modules

| Module              | Aliases | Description                                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------------- |
| `api`               | —       | Codegen for all routes                                                        |
| `service <name>`    | `svc`   | Scaffold a standalone service with stubbed CRUD methods                       |
| `controller <name>` | `ctrl`  | Scaffold a standalone controller with stubbed CRUD routes                     |
| `model <name>`      | `mdl`   | Scaffold a standalone model with a default CRUD-shaped interface or schema    |
| `exception <name>`  | `exc`   | Scaffold a standalone exception class with a default NotImplemented exception |
| `resource <name>`   | `res`   | Scaffold a new resource (model, service, controller, exception)               |

Run `corpus <module> --help` for module-specific flags.

### `corpus api`

Generates types and model interfaces for all routes, and an API client with methods for all routes (unless disabled in config).

```bash
corpus api
```

> Your entry file must call `.listen()` either at the top level or inside a single function.

### `corpus service <name>` (`svc`)

Scaffolds a standalone service with stubbed CRUD methods.

```bash
corpus service <name>
corpus svc --name <name>
```

| Flag           | Description                                        |
| -------------- | -------------------------------------------------- |
| `<name>`, `-n` | Name of the service to generate                    |
| `--empty`      | Generate a bare service with no default CRUD shape |

> This only generates the service file. Without a matching model, the stubbed methods will be untyped.

### `corpus controller <name>` (`ctrl`)

Scaffolds a standalone controller with stubbed CRUD routes.

```bash
corpus controller <name>
corpus ctrl --name <name>
```

| Flag           | Description                        |
| -------------- | ---------------------------------- |
| `<name>`, `-n` | Name of the controller to generate |

> This only generates the controller file. Without a matching model and service, the stubbed routes will be untyped and just throw.

### `corpus model <name>` (`mdl`)

Scaffolds a standalone model with a default CRUD-shaped interface or schema.

```bash
corpus model <name>
corpus mdl --name <name>
```

| Flag           | Description                                      |
| -------------- | ------------------------------------------------ |
| `<name>`, `-n` | Name of the model to generate                    |
| `--empty`      | Generate a bare model with no default CRUD shape |

> This only generates the model file and does not touch any other files.

### `corpus exception <name>` (`exc`)

Scaffolds a standalone exception class with a default `NotImplemented` exception.

```bash
corpus exception <name>
corpus exc --name <name>
```

| Flag           | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `<name>`, `-n` | Name of the exception class to generate                    |
| `--empty`      | Generate a bare exception class with no default exceptions |

> This only generates the exception file and does not touch any other files.

### `corpus resource <name>` (`res`)

Scaffolds a new resource: model, service, controller, and exception together.

```bash
corpus resource <name>
corpus res --name <name>
```

| Flag           | Description                                      |
| -------------- | ------------------------------------------------ |
| `<name>`, `-n` | Name of the resource to generate                 |
| `--empty`      | Generate a bare model with no default CRUD shape |

## Configuration

Define config with `defineConfig`:

```ts
import { defineConfig } from "@ozanarslan/corpus-cli";

export default defineConfig({
	main: "./src/main.ts",
	validationLibrary: "arktype",
	casing: "pascal",
	// ...
});
```

### Options

| Option                  | Type                                                | Default                             | Description                                                                                                                                   |
| ----------------------- | --------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `silent`                | `boolean`                                           | `false`                             | Suppress console logs                                                                                                                         |
| `main`                  | `string`                                            | `"./src/main.ts"`                   | The server entrypoint file path; must contain your instances and `.listen()` call                                                             |
| `pkgPath`               | `string`                                            | `"@ozanarslan/corpus"`              | The corpus package path                                                                                                                       |
| `casing`                | `"pascal" \| "camel" \| "kebab"`                    | `"pascal"`                          | Casing for generated file and directory names                                                                                                 |
| `validationLibrary`     | `"arktype" \| "zod" \| "yup" \| null`               | `null`                              | Validation library to generate models with. Append a version with `@` if needed (default versions: arktype `2.2.0`, yup `1.7.1`, zod `4.3.6`) |
| `output`                | `string`                                            | `"./src/corpus.gen.ts"`             | File path where the generated API client output is written                                                                                    |
| `apiClient`             | `ApiClientConfig`                                   | —                                   | API client specific configuration (see below)                                                                                                 |
| `exportModelsNamespace` | `boolean`                                           | `true`                              | Collects all models into a namespace                                                                                                          |
| `exportArgsNamespace`   | `boolean`                                           | `true`                              | Collects all args (models without the response) into a namespace                                                                              |
| `ignoreGlobalPrefix`    | `boolean`                                           | `true`                              | Generated method/type names ignore the global prefix by default                                                                               |
| `defaultMethods`        | `DefaultMethodsConfig`                              | —                                   | Default method names for scaffolded models, services, and controllers                                                                         |
| `folderStructure`       | `Partial<Record<ImportableKind, \`${string}.ts\`>>` | `"{resource}/{resource}-{kind}.ts"` | Custom output path templates per file kind (see below)                                                                                        |

#### `apiClient`

| Option           | Type      | Default       | Description                                                                |
| ---------------- | --------- | ------------- | -------------------------------------------------------------------------- |
| `disabled`       | `boolean` | `false`       | Disables API client generation. Types and models are still generated       |
| `exportAs`       | `string`  | `"CorpusApi"` | Controls how the API client is exported. Set to `false` to skip the client |
| `useStaticClass` | `boolean` | `false`       | Makes all API client methods and properties static                         |

#### `defaultMethods`

Maps default CRUD method names to your own, for scaffolded models/services/controllers:

```ts
{
	get: { propertyKey: "get", address: "GET /:id" },
	getByParams: { propertyKey: "getByParams", address: "GET /" },
	create: { propertyKey: "create", address: "POST /" },
	update: { propertyKey: "update", address: "PUT /:id" },
	remove: { propertyKey: "remove", address: "DELETE /:id" },
}
```

#### `folderStructure`

Custom output path templates per file kind, letting you control your own folder structure. Each template is a relative path string supporting:

- `{resource}` — the resource name (e.g. `"user"`), cased per the `casing` option
- `{kind}` — the file kind (e.g. `"service"`, `"model"`, `"controller"`, `"route"`), cased per the `casing` option

Kinds without a matching entry fall back to the default template `"{resource}/{resource}-{kind}.ts"`. The file extension is preserved as-is and not affected by casing.

```ts
// group files by kind instead of by resource
{
	model: "models/{resource}-model.ts",
	service: "services/{resource}-service.ts",
	controller: "controllers/{resource}-controller.ts",
}
```

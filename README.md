# Corpus Monorepo

This repository contains the source for the Corpus ecosystem.

## Packages

| Package                                    | Version                                                     | Description        |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| [`@ozanarslan/corpus`](./packages/corpus)  | ![npm](https://img.shields.io/npm/v/@ozanarslan/corpus)     | Core framework     |
| [`@ozanarslan/corpus-cli`](./packages/cli) | ![npm](https://img.shields.io/npm/v/@ozanarslan/corpus-cli) | CLI code generator |

## What is Corpus?

A simple TypeScript backend framework for personal projects and simple CRUD applications. Not a replacement for full-fledged production frameworks.

[Documentation](https://corpus-docs.fly.dev/)

## Getting Started

```bash
bun add @ozanarslan/corpus
```

```typescript
import { C } from "@ozanarslan/corpus";

const server = new C.Server();
new C.Route("/health", () => "ok");
server.listen(3000);
```

## Development

This monorepo uses pnpm workspaces.

```bash
pnpm install
pnpm build         # build all packages
pnpm changeset     # create a changeset
pnpm release       # build and publish
```

## Runtime

Bun only for now. Node support is planned.

## License

MIT

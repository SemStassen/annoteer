# Architecture

Annoteer uses the apps/packages ownership model from [Dillon Mulroy’s Overseer](https://github.com/dmmulroy/overseer/blob/main/docs/coding-standards.md), adapted to a single installable library. Agentation remains a reference for the annotation interaction and simple package installation.

## Workspaces and ownership

- `apps/playground` is the runnable example website. It depends on the public `annoteer` entrypoint. Its Vite development alias points that public name at the local source for hot reload.
- `packages/annoteer` is the single npm distribution. The React widget, CLI, and Worker are built separately inside it, because users install and update them together.
- `packages/annoteer/src/domain` owns the shared Effect schemas and types. It has no browser, Node, Cloudflare, or infrastructure dependencies.
- `src/react` owns the widget and browser API client. It can depend on `domain`, but never on the CLI, server, or infrastructure.
- `src/cli` owns Node command execution and setup. It communicates with a deployed Worker over HTTP and copies prebuilt deployment assets. It never imports the Worker or React implementation.
- `src/server` owns the Worker runtime. `index.ts` handles the runtime boundary and response headers; `handlers.ts` implements routes, authorization, and D1 operations. HTTP decoding, errors, credentials, and environment bindings have explicit modules.
- `infrastructure` owns the Alchemy deployment template and SQL migrations. At installation time it becomes the client project’s private `.annoteer/` deployment application.

These are internal module boundaries, not separate npm packages. There is no shared infrastructure stack to extract yet: each agency installation owns a single Worker and D1 database. If another application needs a capability independently, extract a cohesive package with a public entrypoint at that point.

## Dependency direction

```text
apps/playground ── public annoteer entry ── src/react ──┐
                                            src/cli ─┼─ src/domain
                                         src/server ─┘

src/react and src/cli ── HTTP ── deployed Worker ── D1
```

`pnpm check` verifies module import boundaries before formatting/linting. Packages cannot import application code. The browser bundle cannot import Node, server, CLI, or deployment modules. Domain code cannot import runtime-specific modules. Runtime imports between React, CLI, and server go through their real HTTP interfaces, not source paths.

## Build and distribution

Vite+ owns the three packaging jobs in `packages/annoteer/vite.config.ts`. A single cleanup runs before these jobs, avoiding overlapping output deletion. Packaging preserves the public contracts:

- `annoteer` and `annoteer/react`: the React entrypoint and declarations.
- `annoteer` executable: `dist/cli/index.mjs`.
- `template/`: the standalone Worker, SQL migrations, and Alchemy entrypoint consumed by setup.

`apps/playground` is independently built with Vite+. Root scripts coordinate builds and local development; deployment remains an uncached operation performed in the user’s private infrastructure project.

## Effect and infrastructure versions

Overseer currently uses Effect 4 and Alchemy 2 prereleases. This structural refactor retains Annoteer’s existing Effect 3 and Alchemy 0.94 dependencies. Adopting those architectural ownership rules does not require an API migration. Domain validation uses Effect Schema; effects are executed at browser, Node, and Worker boundaries.

## Verification

API integration tests exercise the built Worker against local D1. Browser tests exercise real client/agency sessions over HTTP. Package smoke tests install the actual tarball in a fresh project and check React server rendering, CLI entrypoints, shipped infrastructure assets, and setup resumption. This verifies both runtime behavior and the distribution boundary after moving source files.

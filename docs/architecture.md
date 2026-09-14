# Architecture

Annoteer uses the apps/packages ownership model from [Dillon Mulroy’s Overseer](https://github.com/dmmulroy/overseer/blob/main/docs/coding-standards.md), adapted to a single installable library. Agentation remains a reference for the annotation interaction and simple package installation.

## Workspaces and ownership

- `apps/playground` is the runnable example website. It depends on the public `annoteer` entrypoint. Its Vite development alias points that public name at the local source for hot reload.
- `packages/annoteer` is the single npm distribution. The React widget, CLI, and Worker are built separately inside it, because users install and update them together.
- `packages/annoteer/src/domain` owns the shared Effect schemas and types. It has no browser, Node, Cloudflare, or infrastructure dependencies.
- `src/react` owns the widget and browser API client. It can depend on `domain`, but never on the CLI, server, or infrastructure.
- `src/cli` owns Node command execution and setup. It communicates with a deployed Worker over HTTP and copies prebuilt deployment assets. It never imports the Worker or React implementation.
- `src/server` owns the Worker runtime. `index.ts` supplies the D1 Effect Layer and deployment settings at the runtime boundary. `router.ts` dispatches requests after authorization. Invitations, sessions, and annotations each own their feature routes; `auth.ts` checks sessions and revocations. `database.ts` adapts D1 into the `Database` capability, so feature modules do not receive Cloudflare bindings.
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

## Internal modules

The file boundaries follow [Overseer’s coding standards](https://github.com/dmmulroy/overseer/blob/main/docs/coding-standards.md): keep cohesive capabilities together, compose dependencies at runtime entrypoints, and avoid packages created for hypothetical reuse. These are incremental changes using Effect 3; Annoteer does not adopt every Overseer convention or its prerelease APIs.

```text
src/react/
  widget.tsx                 Composes review state, UI, and feedback writes
  hooks/
    use-review-session.ts    Invitation entry, login/logout, private session storage
    use-annotations.ts       Visible-tab polling and explicit refresh
    use-page-selection.ts    Text/element capture and private-area exclusions
    use-annotation-positions.ts  DOM observation and anchor positions
    use-shadow-root.ts       Overlay mount/unmount
  components/                Entry, composer, discussion, and feedback list
  anchors.ts, api.ts, styles.ts
src/cli/
  index.ts                   Runs Effect and reports process failure
  program.ts                 Dispatches commands
  arguments.ts               Argument parsing and help
  commands/                  Init, deploy, and invitation workflows
  setup.ts                   Resumable infrastructure scaffolding
  project.ts                 Project files, site URLs, and review links
  process.ts, admin-api.ts, errors.ts
src/server/
  index.ts                   Cloudflare composition and HTTP response policy
  router.ts                  Route selection and authentication gates
  auth.ts                    Agency credentials and live session validation
  invitations.ts             Invitation lifecycle
  sessions.ts                Invitation exchange and password attempt limits
  annotations.ts             Feedback, replies, and status changes
  database.ts                Effect capability and D1 adapter
  password.ts, credentials.ts, http.ts, errors.ts, env.ts
```

React components receive values and callbacks. They do not import API clients or hooks; hooks do not import presentation components. The widget connects the two and coordinates writes. Each subscription hook owns its cleanup. Browser storage remains private to the session hook, and passwords are never persisted.

Worker feature modules keep their related SQL and request behavior together. `Database` is the explicit Effect requirement supplied by the Worker, not a global connection. It normalizes D1 results and failures; feature modules own query meaning and response mapping. Password policy is a small value passed from deployment settings. There is no additional repository/service layer for each query.

CLI command modules own workflows. Process and HTTP adapters own external calls; project helpers own file access and URL construction. Importing a command or `program.ts` does not execute the CLI. Only `index.ts` runs the program.

The boundary checker enforces these internal directions as well as the runtime boundaries above. Public imports, the executable, configuration, HTTP routes, and database schema remain unchanged by this refactor.

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

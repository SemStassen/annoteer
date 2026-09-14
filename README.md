# ↗ annoteer

**Client feedback, right where it belongs.**

An independent, open-source React widget for agencies and their clients. Highlight text, point at an element, leave a note, and resolve it together. The feedback lives in your own Cloudflare account. Clients only need a review link.

Built with **React · TypeScript · Effect · Alchemy · Vite+**. Inspired by Agentation’s ease of use; no Agentation code or dependency.

## Try the MVP locally

Requires Node.js 22.12+ and [Vite+](https://viteplus.dev/guide/).

```sh
git clone https://github.com/SemStassen/annoteer.git
cd annoteer
pnpm install
pnpm dev
```

Open **http://127.0.0.1:5173**. Choose “Review as client” or “Review as agency”. Both use the real Worker API and a local SQLite-backed D1 database through Miniflare. No Cloudflare account is needed for the demo. Local demo data persists in `.annoteer/demo/`; its disposable credentials are only used on loopback interfaces.

## Install in another project

This repo is an MVP; **the npm package has not been published yet**. Build a tarball first:

```sh
pnpm build
pnpm run pack
# In your React project (use the absolute path to the generated file):
npm install /path/to/annoteer/artifacts/annoteer-0.1.0.tgz
npx annoteer init --site https://preview.your-client.com --name client-feedback
```

Setup installs an isolated Alchemy deployment project, opens Cloudflare authentication, creates D1, applies migrations, deploys a Worker, checks its health, and generates agency/client review links. A Cloudflare account with Workers and D1 permissions and an enabled workers.dev subdomain is required. Resources run on your account and are subject to Cloudflare’s usage limits and billing.

Add the generated component to your app’s root layout:

```tsx
import AnnoteerFeedback from "./annoteer";

export default function App() {
  return (
    <>
      <YourApp />
      <AnnoteerFeedback />
    </>
  );
}
```

Or use the component directly:

```tsx
import { Annoteer } from "annoteer"; // 'annoteer/react' also works

<Annoteer endpoint="https://client-feedback.YOUR-SUBDOMAIN.workers.dev" />;
```

For Next.js, place the generated `'use client'` component in the root layout. The package is SSR-safe. Only the public endpoint belongs in frontend configuration. The widget is invisible unless a review invitation or existing session is present.

After a future npm release, installation starts with `npx annoteer init`. **The MVP generates the integration component; adding it to your root layout is currently one manual step.**

## Review flow

1. Share the **client** link. Keep the **agency** link private.
2. The reviewer enters their name—no account or password.
3. Choose **Add feedback**, then click an element or drag to select text.
4. Discuss feedback in threads. Agency reviewers can resolve or reopen notes.
5. New feedback syncs every five seconds while the page is visible.

```sh
npx annoteer invite --label "Alex at Studio" --days 14
npx annoteer invite --role agency --label "Project team"
npx annoteer invites
npx annoteer revoke INVITATION_ID
npx annoteer deploy
```

Invitations expire after 30 days by default (1–90 configurable). A reviewer session lasts at most seven days and never outlives its invitation. Revoking a link immediately invalidates its sessions. Anyone holding a project’s client link can read and comment on that project’s feedback. Names are self-reported, not verified identities. Use a **separate deployment per client project**.

## Configuration and data

- `annoteer.config.json`: public Worker endpoint; safe to commit.
- `annoteer.tsx`: generated integration component; safe to commit.
- `.annoteer/`: private deployment project, credentials, Alchemy state, links. Gitignored **before** secrets are written. Back it up securely; retain its state and encryption password for redeployments. Do not commit it or put it under a static/public directory.
- `.annoteer/config.json`: project name, site URL, exact allowed origins. Add other preview origins here, then run `annoteer deploy`.
- `deployment` prop: isolates feedback by version, default `main`. Keep the same value for reviewers of the same version.
- `data-annoteer-id="hero-title"`: optional stable anchor for important elements.
- `data-annoteer-ignore`: prevents selecting private areas. Form controls and editable fields are excluded by default.
- `nonce` prop: supplies the widget’s style nonce for CSP-enabled sites; allow your Worker endpoint in `connect-src`.

The API validates requests with Effect Schema, stores only hashes of invite/session tokens, enforces role checks, bounds request sizes, and applies per-session write quotas. CORS is an additional restriction, not authentication. The invitation is placed in the URL fragment, removed on entry, and exchanged for a session kept in sessionStorage. Page queries are intentionally excluded from stored page paths.

Annoteer captures the selected element’s label/selector and, for text, the quote and surrounding context. It does not capture screenshots, input values, or full-page HTML. Only enable it on sites where this content may be shared with reviewers. Infrastructure retains D1 on teardown; database deletion is deliberate and manual.

## Repository

```text
apps/playground/                    Runnable Vite+ React example
packages/annoteer/                   Single publishable npm package
  src/react/                        Widget, anchors, browser API client
  src/cli/                          Setup, deployment, invitation commands
  src/server/                       Worker entrypoint, HTTP handlers, credentials
  src/domain/                       Shared Effect schemas and types
  infrastructure/                   Alchemy template and SQL migrations
docs/                               Architecture and ownership rules
scripts/                            Build, local development, boundary checks
tests/                              API, setup, and browser integration tests
```

The layout takes inspiration from [Overseer’s workspace boundaries](https://github.com/dmmulroy/overseer/blob/main/docs/coding-standards.md): runnable apps live under `apps/`, reusable code under `packages/`, and runtime entrypoints stay thin. Annoteer keeps one public npm package with explicit React, CLI, server, and domain modules. See [the architecture notes](https://github.com/SemStassen/annoteer/blob/main/docs/architecture.md).

Vite+ packs the React library, Node CLI, and standalone Worker separately. Consumers install one package; Alchemy is installed only into the generated deployment project, not the browser bundle. Alchemy stays pinned to 0.94.0 and Effect to the 3.x line; the structural changes do not require a prerelease migration.

```sh
pnpm build        # vp pack library/CLI/Worker, vp build demo
pnpm typecheck
pnpm test         # real local D1 API and setup tests
pnpm exec playwright install chromium # first browser test run
pnpm test:e2e     # browser review flow (starts local demo)
pnpm check        # Vite+ format and lint
pnpm run pack         # artifacts/annoteer-0.1.0.tgz
pnpm test:package     # install tarball in a fresh project; verify SSR + CLI
```

## MVP boundaries

React 18+, modern desktop browsers, one client project per Worker. Annotations re-anchor after scrolling/resizing and DOM updates; uncertain or missing targets are marked as changed rather than silently moved. No cross-origin iframe or nested Shadow DOM selection, screenshots, notifications, verified accounts, automatic framework editing, hash-router support, or live cursors yet. Lists show up to 500 annotations per deployment. Rate quotas are basic abuse controls, not a substitute for edge rate limiting on a public high-traffic service.

Cloudflare deployment requires an interactive agency login or a configured `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`. Use `--skip-login` for an existing Alchemy profile. Use `init --skip-install --skip-deploy` for offline scaffolding. Deployment should be smoke-tested against your Cloudflare account before relying on it for a client engagement.

MIT licensed. Contributions welcome.

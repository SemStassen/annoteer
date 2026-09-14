#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { Effect } from "effect";
import {
  exists,
  operation,
  parseSite,
  readJson,
  reviewLink,
  scaffold,
  writeJson,
  type Config,
} from "./setup";

const help = `
  ↗ annoteer — client feedback, right where it belongs.

  annoteer init [--site URL] [--name NAME]
      Sign in to Cloudflare, deploy your feedback API, and create review links.
  annoteer deploy
      Update the Worker and apply migrations using existing credentials/state.
  annoteer invite [--role client|agency] [--days 30] [--label NAME]
      Create a private review link (client role by default).
  annoteer invites
      List invitation IDs and expiry dates.
  annoteer revoke INVITATION_ID
      Revoke a link and all sessions created from it.

  Options: --cwd DIR, --skip-login, --skip-install, --skip-deploy, --help
  init --skip-install --skip-deploy scaffolds without making network requests.
  Node.js 22.12+ required. Cloudflare login is for the agency only.
`;
const command = (file: string, args: string[], cwd: string) =>
  operation(
    () =>
      new Promise<void>((ok, reject) => {
        const child = spawn(file, args, { cwd, stdio: "inherit", shell: false });
        child.once("error", reject);
        child.once("exit", (code, signal) =>
          code === 0
            ? ok()
            : reject(
                new Error(
                  `${file} ${args[0]} failed (${signal ?? code}). Fix the error above, then rerun the command to resume.`,
                ),
              ),
        );
      }),
  );
const ask = (prompt: string, fallback?: string) =>
  operation(async () => {
    if (!process.stdin.isTTY)
      throw new Error(
        `Missing ${prompt}. Provide --site and --name when running non-interactively.`,
      );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (
        (await rl.question(`${prompt}${fallback ? ` (${fallback})` : ""}: `)).trim() ||
        fallback ||
        ""
      );
    } finally {
      rl.close();
    }
  });
const api = <T>(
  endpoint: string,
  adminToken: string,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) =>
  operation(async () => {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `API returned ${response.status}`);
    return data;
  });
const main = Effect.gen(function* () {
  const { values, positionals } = yield* Effect.try(() =>
    parseArgs({
      allowPositionals: true,
      options: {
        site: { type: "string" },
        name: { type: "string" },
        cwd: { type: "string" },
        role: { type: "string" },
        days: { type: "string" },
        label: { type: "string" },
        "skip-login": { type: "boolean" },
        "skip-install": { type: "boolean" },
        "skip-deploy": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    }),
  );
  const action = positionals[0];
  if (!action || values.help) {
    console.log(help);
    return;
  }
  if (!["init", "deploy", "invite", "invites", "revoke"].includes(action))
    throw new Error(`Unknown command: ${action}. Run annoteer --help.`);
  const cwd = resolve(values.cwd ?? process.cwd());
  const dir = join(cwd, ".annoteer");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  if (action === "init") {
    console.log("\n  ↗ Let’s make room for feedback.\n");
    const saved = yield* operation(async () =>
      (await exists(join(dir, "config.json"))) ? readJson<Config>(join(dir, "config.json")) : null,
    );
    const siteInput = values.site ?? saved?.site ?? (yield* ask("Website URL"));
    const site = yield* Effect.try(() => parseSite(siteInput).toString());
    const name = values.name ?? saved?.name ?? (yield* ask("Project name", "annoteer-feedback"));
    const config = { name, site, origins: [new URL(site).origin] };
    yield* scaffold(cwd, config);
    console.log("  ✓ Infrastructure scaffolded in .annoteer/ (gitignored).");
    if (!values["skip-install"]) {
      yield* command(npm, ["install", "--no-audit", "--no-fund"], dir);
      const installed = yield* operation(async () => {
        try {
          createRequire(join(cwd, "package.json")).resolve("annoteer");
          return true;
        } catch {
          return false;
        }
      });
      if (!installed) {
        const pnpm = awaitFile(cwd, "pnpm-lock.yaml");
        const manager = (yield* pnpm) ? (process.platform === "win32" ? "pnpm.cmd" : "pnpm") : npm;
        yield* command(
          manager,
          [manager.startsWith("pnpm") ? "add" : "install", "annoteer@0.1.0"],
          cwd,
        );
      }
    }
    if (values["skip-deploy"]) {
      console.log("  Scaffold ready. Run annoteer init again to install and deploy.");
      return;
    }
  }
  const config = yield* operation(() => readJson<Config>(join(dir, "config.json")));
  const secrets = yield* operation(() =>
    readJson<{ adminToken: string }>(join(dir, "secrets.json")),
  );
  if (action === "init" || action === "deploy") {
    if (action === "deploy") yield* scaffold(cwd, config);
    if (!values["skip-login"] && !process.env.CLOUDFLARE_API_TOKEN)
      yield* command(npm, ["run", "login"], dir);
    yield* command(npm, ["run", "deploy"], dir);
    const output = yield* operation(() => readJson<{ endpoint: string }>(join(dir, "output.json")));
    yield* api(output.endpoint, secrets.adminToken, "/health");
    yield* operation(() =>
      writeJson(join(cwd, "annoteer.config.json"), { endpoint: output.endpoint }),
    );
    const snippet = `'use client';\nimport { Annoteer } from 'annoteer';\nimport config from './annoteer.config.json';\n\nexport default function AnnoteerFeedback() {\n  return <Annoteer endpoint={config.endpoint} />;\n}\n`;
    yield* operation(async () => {
      const path = join(cwd, "annoteer.tsx");
      if (!(await exists(path))) await writeFile(path, snippet);
    });
    console.log(
      "\n  ✓ Your feedback backend is ready.\n  Add <AnnoteerFeedback /> from annoteer.tsx to your root layout.\n",
    );
    if (action === "init") {
      const existingLinks = join(dir, "review-links.json");
      // Persist each invitation immediately so interrupted setup can resume.
      const links = yield* operation(async () =>
        (await exists(existingLinks))
          ? readJson<Record<string, string>>(existingLinks)
          : ({} as Record<string, string>),
      );
      for (const role of ["agency", "client"] as const) {
        if (!links[role]) {
          const invite = yield* api<{ token: string }>(
            output.endpoint,
            secrets.adminToken,
            "/admin/invitations",
            { role, label: `Initial ${role} review`, days: 30 },
          );
          links[role] = reviewLink(config.site, invite.token);
          yield* operation(() => writeJson(existingLinks, links, true));
        }
        console.log(
          `  ${role === "agency" ? "Agency (keep private)" : "Client (share this)"}: ${links[role]}\n`,
        );
      }
    }
    return;
  }
  const { endpoint } = yield* operation(() =>
    readJson<{ endpoint: string }>(join(dir, "output.json")),
  );
  if (action === "invite") {
    const role = values.role ?? "client";
    const days = Number(values.days ?? 30);
    if (!["client", "agency"].includes(role) || !Number.isInteger(days) || days < 1 || days > 90)
      throw new Error("Use --role client|agency and --days between 1 and 90.");
    const invite = yield* api<{ id: string; token: string }>(
      endpoint,
      secrets.adminToken,
      "/admin/invitations",
      { role, days, label: values.label ?? `${role} review` },
    );
    console.log(`\n  Invitation: ${invite.id}\n  ${reviewLink(config.site, invite.token)}\n`);
  } else if (action === "invites")
    console.table(yield* api(endpoint, secrets.adminToken, "/admin/invitations"));
  else if (action === "revoke") {
    if (!positionals[1] || !/^[\w-]+$/.test(positionals[1]))
      throw new Error("Provide an invitation ID from annoteer invites.");
    yield* api(
      endpoint,
      secrets.adminToken,
      `/admin/invitations/${positionals[1]}`,
      undefined,
      "DELETE",
    );
    console.log("  ✓ Invitation and its sessions revoked.");
  }
});
function awaitFile(cwd: string, name: string) {
  return operation(() => exists(join(cwd, name)));
}
Effect.runPromise(main).catch((error: unknown) => {
  console.error(`\n  Annoteer: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { Effect } from "effect";
import { operation } from "../errors";
import { exists, readJson, reviewLink, writeJson, type Config } from "../project";
import { scaffold } from "../setup";
import { command } from "../process";
import { adminRequest } from "../admin-api";
import type { Arguments } from "../arguments";

/** Deploys saved infrastructure, verifies health, and writes the public integration. */
export const deploy = (
  cwd: string,
  values: Arguments,
  action: "init" | "deploy",
  config: Config,
  secrets: { adminToken: string },
) =>
  Effect.gen(function* () {
    const dir = join(cwd, ".annoteer");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    if (action === "deploy") {
      yield* scaffold(cwd, config);
      if (!values["skip-install"]) yield* command(npm, ["install", "--no-audit", "--no-fund"], dir);
    }
    if (!values["skip-login"] && !process.env.CLOUDFLARE_API_TOKEN)
      yield* command(npm, ["run", "login"], dir);
    yield* command(npm, ["run", "deploy"], dir);
    const output = yield* operation(() => readJson<{ endpoint: string }>(join(dir, "output.json")));
    yield* adminRequest(output.endpoint, secrets.adminToken, "/health");
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
          const invite = yield* adminRequest<{ token: string }>(
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
  });

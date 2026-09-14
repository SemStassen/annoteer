import { createRequire } from "node:module";
import { join } from "node:path";
import { Effect } from "effect";
import { operation } from "../errors";
import { exists, parseSite, readJson, type Config } from "../project";
import { scaffold } from "../setup";
import { command, ask } from "../process";
import type { Arguments } from "../arguments";

/** Resumes scaffolding and installation; returns whether deployment should follow. */
export const initialize = (cwd: string, values: Arguments) =>
  Effect.gen(function* () {
    const dir = join(cwd, ".annoteer");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
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
        const pnpm = operation(() => exists(join(cwd, "pnpm-lock.yaml")));
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
      return false;
    }
    return true;
  });

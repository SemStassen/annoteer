import { randomBytes } from "node:crypto";
import { chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { operation } from "./errors";
import { exists, parseSite, readJson, writeJson, type Config } from "./project";

export const scaffold = (
  cwd: string,
  config: Config,
  template = fileURLToPath(new URL("../../template/", import.meta.url)),
) =>
  operation(async () => {
    const dir = join(cwd, ".annoteer");
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(config.name))
      throw new Error(
        "Project name must be 3–40 lowercase letters, numbers, or hyphens, starting with a letter.",
      );
    parseSite(config.site);
    // Ignore secrets before writing them, including when setup is interrupted.
    const ignore = join(cwd, ".gitignore");
    const previous = (await exists(ignore)) ? await readFile(ignore, "utf8") : "";
    const missing = ["/.annoteer/", "/annoteer.jsonc"].filter(
      (line) => !previous.split("\n").includes(line),
    );
    if (missing.length)
      await writeFile(
        ignore,
        `${previous}${previous && !previous.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`,
      );
    const reviewConfig = join(cwd, "annoteer.jsonc");
    if (!(await exists(reviewConfig)))
      await writeFile(
        reviewConfig,
        '{\n  // Optional password required with client review links.\n  // Uncomment, choose your password, then run: npx annoteer deploy\n  // "password": "replace-with-your-password"\n}\n',
        { mode: 0o600 },
      );
    await chmod(reviewConfig, 0o600);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const configPath = join(dir, "config.json");
    if (await exists(configPath)) {
      const existing = await readJson<Config>(configPath);
      if (existing.name !== config.name || existing.site !== config.site)
        throw new Error(
          "This project already has an Annoteer setup. Run annoteer deploy to update it.",
        );
    } else await writeJson(configPath, config, true);
    await chmod(configPath, 0o600);
    const secretsPath = join(dir, "secrets.json");
    if (!(await exists(secretsPath)))
      await writeJson(
        secretsPath,
        { adminToken: randomBytes(32).toString("hex"), password: randomBytes(32).toString("hex") },
        true,
      );
    await cp(template, dir, { recursive: true });
    await writeJson(join(dir, "package.json"), {
      name: `${config.name}-infrastructure`,
      private: true,
      type: "module",
      scripts: { deploy: "node --import tsx alchemy.run.ts", login: "alchemy login cloudflare" },
      dependencies: {
        alchemy: "0.94.0",
        tsx: "4.23.13",
        bcryptjs: "3.0.3",
        "jsonc-parser": "3.3.1",
      },
    });
    return resolve(dir);
  });

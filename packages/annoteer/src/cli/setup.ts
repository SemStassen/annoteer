import { randomBytes } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Data, Effect } from "effect";

export class SetupError extends Data.TaggedError("SetupError")<{ message: string }> {}
export const operation = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) =>
      new SetupError({ message: cause instanceof Error ? cause.message : String(cause) }),
  });
export interface Config {
  name: string;
  site: string;
  origins: string[];
}
export const parseSite = (site: string) => {
  const url = new URL(site);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Use an http(s) site URL without credentials.");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Use HTTPS for deployed sites. HTTP is only supported on localhost.");
  url.hash = "";
  return url;
};
export const reviewLink = (site: string, token: string) => {
  const url = parseSite(site);
  url.hash = new URLSearchParams({ annoteer: token }).toString();
  return url.toString();
};
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}
export async function writeJson(path: string, value: unknown, secret = false) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: secret ? 0o600 : 0o644 });
}
export async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

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
    if (!previous.split("\n").includes("/.annoteer/"))
      await writeFile(
        ignore,
        `${previous}${previous && !previous.endsWith("\n") ? "\n" : ""}/.annoteer/\n`,
      );
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const configPath = join(dir, "config.json");
    if (await exists(configPath)) {
      const existing = await readJson<Config>(configPath);
      if (existing.name !== config.name || existing.site !== config.site)
        throw new Error(
          "This project already has an Annoteer setup. Run annoteer deploy to update it.",
        );
    } else await writeJson(configPath, config);
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
      dependencies: { alchemy: "0.94.0", tsx: "4.23.13" },
    });
    return resolve(dir);
  });

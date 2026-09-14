import { readFile, writeFile } from "node:fs/promises";

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

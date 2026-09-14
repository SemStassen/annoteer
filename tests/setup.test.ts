import { afterEach, expect, it } from "vite-plus/test";
import { Effect } from "effect";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { parseSite, reviewLink, scaffold } from "../cli/src/setup";
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
it("scaffolds a resumable private deployment without leaking secrets into public files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "annoteer-test-"));
  dirs.push(cwd);
  const config = {
    name: "client-feedback",
    site: "https://preview.example/",
    origins: ["https://preview.example"],
  };
  const dir = await Effect.runPromise(scaffold(cwd, config, resolve("package/template")));
  const secrets = await readFile(join(dir, "secrets.json"), "utf8");
  await Effect.runPromise(scaffold(cwd, config, resolve("package/template")));
  expect(await readFile(join(dir, "secrets.json"), "utf8")).toBe(secrets);
  expect((await stat(join(dir, "secrets.json"))).mode & 0o777).toBe(0o600);
  expect(await readFile(join(cwd, ".gitignore"), "utf8")).toBe("/.annoteer/\n");
  expect(await readFile(join(dir, "config.json"), "utf8")).not.toContain("adminToken");
  await expect(
    Effect.runPromise(scaffold(cwd, { ...config, name: "different" }, resolve("package/template"))),
  ).rejects.toThrow("already has");
});
it("keeps invitation credentials in fragments and rejects unsafe website URLs", () => {
  expect(reviewLink("https://example.com/review?preview=1", "secret")).toBe(
    "https://example.com/review?preview=1#annoteer=secret",
  );
  expect(() => parseSite("javascript:alert(1)")).toThrow();
  expect(() => parseSite("http://example.com")).toThrow();
  expect(() => parseSite("https://user:password@example.com")).toThrow();
  expect(parseSite("http://127.0.0.1:5173").origin).toBe("http://127.0.0.1:5173");
});

import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { Miniflare } from "miniflare";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  prepareReviewPassword,
  readReviewConfig,
} from "../packages/annoteer/infrastructure/password";

let dir: string;
let mf: Miniflare;
const admin = "b".repeat(64);
const password = "studio-review-2026";
const options = (settings = { passwordHash: "", passwordVersion: "initial-policy" }) => ({
  modules: true,
  scriptPath: "packages/annoteer/template/worker/index.js",
  compatibilityDate: "2026-07-01",
  d1Databases: ["DB"],
  d1Persist: join(dir, "db"),
  bindings: {
    ADMIN_TOKEN: admin,
    ALLOWED_ORIGINS: "https://preview.example",
    REVIEW_PASSWORD_HASH: settings.passwordHash,
    REVIEW_PASSWORD_VERSION: settings.passwordVersion,
  },
});
const call = (path: string, body?: unknown, token?: string) =>
  mf.dispatchFetch(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function invite(role = "client") {
  return (await (
    await call("/admin/invitations", { role, label: "Password test", days: 30 }, admin)
  ).json()) as { token: string };
}
async function login(token: string, password?: string) {
  return call("/sessions", { token, name: "Reviewer", password });
}
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "annoteer-password-"));
  mf = new Miniflare(options());
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("packages/annoteer/infrastructure/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    for (const sql of (
      await readFile(`packages/annoteer/infrastructure/migrations/${file}`, "utf8")
    )
      .split(";")
      .filter((part) => part.trim()))
      await db.prepare(sql).run();
  }
});
afterAll(async () => {
  await mf?.dispose();
  if (dir) await rm(dir, { recursive: true, force: true });
});
it("reads JSONC, rejects invalid settings without exposing passwords, and keeps hashes stable on redeploy", async () => {
  const configPath = join(dir, "annoteer.jsonc");
  const hashPath = join(dir, "hash.json");
  expect(await readReviewConfig(configPath)).toEqual({});
  await writeFile(configPath, `{\n// Private review setting\n"password": "${password}",\n}`);
  expect(await readReviewConfig(configPath)).toEqual({ password });
  const first = await prepareReviewPassword(password, hashPath);
  expect(first.passwordHash).not.toContain(password);
  expect(await prepareReviewPassword(password, hashPath)).toEqual(first);
  for (const value of [
    '{"password": 123}',
    '{"password": "short"}',
    '{"pasword": "secret-value"}',
    '{"password": "broken",',
    "[]",
    '{"password": ""}',
  ]) {
    await writeFile(configPath, value);
    await expect(readReviewConfig(configPath)).rejects.not.toThrow("secret-value");
  }
  await expect(prepareReviewPassword("é".repeat(37), hashPath)).rejects.toThrow("72 UTF-8 bytes");
  expect((await prepareReviewPassword(undefined, hashPath)).passwordHash).toBe("");
});
it("requires passwords for clients, prevents bypasses, limits guesses, and invalidates sessions when changed or removed", async () => {
  const client = await invite();
  const agency = await invite("agency");
  const oldClient = (await (await login(client.token)).json()) as { token: string };
  const agencySession = (await (await login(agency.token)).json()) as { token: string };
  const hashPath = join(dir, "live-hash.json");
  const first = await prepareReviewPassword(password, hashPath);
  await mf.setOptions(options(first));
  expect((await call("/annotations", undefined, oldClient.token)).status).toBe(401);
  expect((await call("/annotations", undefined, agencySession.token)).status).toBe(200);
  expect(await (await call("/review-access", { token: client.token })).json()).toEqual({
    passwordRequired: true,
  });
  expect(await (await call("/review-access", { token: agency.token })).json()).toEqual({
    passwordRequired: false,
  });
  expect((await login(client.token)).status).toBe(401);
  expect((await login(client.token, "wrong-password")).status).toBe(401);
  expect(
    (
      await call("/sessions", {
        token: client.token,
        name: "Bypass",
        role: "agency",
        password: "wrong-password",
      })
    ).status,
  ).toBe(401);
  const valid = await login(client.token, password);
  expect(valid.status).toBe(201);
  const session = (await valid.json()) as { token: string; role: string };
  expect(session.role).toBe("client");
  expect((await call("/annotations", undefined, session.token)).status).toBe(200);
  await mf.setOptions(options(await prepareReviewPassword(password, hashPath)));
  expect((await call("/annotations", undefined, session.token)).status).toBe(200);
  const limited = await invite();
  for (let attempt = 0; attempt < 10; attempt++)
    expect((await login(limited.token, "wrong-password")).status).toBe(401);
  expect((await login(limited.token, password)).status).toBe(429);
  const changed = await prepareReviewPassword("a-new-review-password", hashPath);
  await mf.setOptions(options(changed));
  expect((await call("/annotations", undefined, session.token)).status).toBe(401);
  expect((await login(client.token, password)).status).toBe(401);
  const replacement = (await (await login(client.token, "a-new-review-password")).json()) as {
    token: string;
  };
  expect((await call("/annotations", undefined, replacement.token)).status).toBe(200);
  await mf.setOptions(options(await prepareReviewPassword(undefined, hashPath)));
  expect((await call("/annotations", undefined, oldClient.token)).status).toBe(401);
  expect((await call("/annotations", undefined, replacement.token)).status).toBe(401);
  expect((await login(client.token)).status).toBe(201);
  expect((await call("/annotations", undefined, agencySession.token)).status).toBe(200);
});

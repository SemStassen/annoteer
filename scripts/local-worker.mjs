import { Miniflare } from "miniflare";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const DEMO_ADMIN = "a".repeat(64);
export async function localWorker({ port, persist } = {}) {
  if (persist) await mkdir(persist, { recursive: true });
  const mf = new Miniflare({
    modules: true,
    scriptPath: fileURLToPath(new URL("../package/template/worker/index.js", import.meta.url)),
    compatibilityDate: "2026-07-01",
    host: "127.0.0.1",
    ...(port ? { port } : {}),
    d1Databases: ["DB"],
    ...(persist ? { d1Persist: persist } : {}),
    bindings: {
      ADMIN_TOKEN: DEMO_ADMIN,
      ALLOWED_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173",
    },
  });
  const db = await mf.getD1Database("DB");
  const migration = await readFile(
    new URL("../worker/migrations/0001_initial.sql", import.meta.url),
    "utf8",
  );
  for (const sql of migration.split(";").filter((part) => part.trim())) await db.prepare(sql).run();
  await mf.ready;
  return mf;
}

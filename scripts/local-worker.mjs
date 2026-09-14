import { migrateLocal } from "./migrate-local.mjs";
import {
  readReviewConfig,
  prepareReviewPassword,
} from "../packages/annoteer/infrastructure/password.ts";
import { Miniflare } from "miniflare";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const DEMO_ADMIN = "a".repeat(64);
export async function localWorker({ port, persist } = {}) {
  if (persist) await mkdir(persist, { recursive: true });
  const config = await readReviewConfig(
    fileURLToPath(new URL("../annoteer.jsonc", import.meta.url)),
  );
  const reviewAccess = await prepareReviewPassword(
    config.password,
    fileURLToPath(new URL("../.annoteer/demo/review-password.json", import.meta.url)),
  );
  const mf = new Miniflare({
    modules: true,
    scriptPath: fileURLToPath(
      new URL("../packages/annoteer/template/worker/index.js", import.meta.url),
    ),
    compatibilityDate: "2026-07-01",
    host: "127.0.0.1",
    ...(port ? { port } : {}),
    d1Databases: ["DB"],
    ...(persist ? { d1Persist: persist } : {}),
    bindings: {
      REVIEW_PASSWORD_HASH: reviewAccess.passwordHash,
      REVIEW_PASSWORD_VERSION: reviewAccess.passwordVersion,
      ADMIN_TOKEN: DEMO_ADMIN,
      ALLOWED_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173",
    },
  });
  const db = await mf.getD1Database("DB");
  await migrateLocal(db);
  await mf.ready;
  return mf;
}

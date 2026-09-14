import alchemy from "alchemy";
import { D1Database, Worker } from "alchemy/cloudflare";
import { readFile, writeFile } from "node:fs/promises";

const config = JSON.parse(await readFile("./config.json", "utf8")) as {
  name: string;
  origins: string[];
};
const secrets = JSON.parse(await readFile("./secrets.json", "utf8")) as {
  adminToken: string;
  password: string;
};
const app = await alchemy(config.name, { stage: "prod", password: secrets.password });
const db = await D1Database("feedback", {
  name: `${config.name}-feedback`,
  migrationsDir: "./migrations",
  delete: false,
});
export const worker = await Worker("api", {
  name: config.name,
  entrypoint: "./worker/index.js",
  url: true,
  compatibilityDate: "2026-07-01",
  bindings: {
    DB: db,
    ADMIN_TOKEN: alchemy.secret(secrets.adminToken),
    ALLOWED_ORIGINS: config.origins.join(","),
  },
});
await app.finalize();
if (!worker.url)
  throw new Error(
    "Cloudflare did not return a Worker URL. Enable your workers.dev subdomain and retry.",
  );
await writeFile("./output.json", JSON.stringify({ endpoint: worker.url }, null, 2) + "\n");
console.log(`Annoteer API: ${worker.url}`);

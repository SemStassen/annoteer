import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite-plus";
import { localWorker, DEMO_ADMIN } from "./local-worker.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
await new Promise((ok, reject) => {
  const child = spawn("pnpm", ["--filter", "annoteer", "build"], { cwd: root, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => (code === 0 ? ok() : reject(new Error("Build failed."))));
});
const worker = await localWorker({
  port: 8787,
  persist: fileURLToPath(new URL("../.annoteer/demo/db", import.meta.url)),
});
const demoMiddleware = async (req, res) => {
  // Development only. This middleware is never in the production build.
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  if (req.headers.host !== "127.0.0.1:5173" && req.headers.host !== "localhost:5173") {
    res.statusCode = 403;
    res.end();
    return;
  }
  try {
    const links = {};
    for (const role of ["agency", "client"]) {
      const response = await worker.dispatchFetch("http://localhost/admin/invitations", {
        method: "POST",
        headers: { authorization: `Bearer ${DEMO_ADMIN}`, "content-type": "application/json" },
        body: JSON.stringify({ role, label: `Local demo ${role}`, days: 30 }),
      });
      if (!response.ok) throw new Error("Could not create demo invitations.");
      const { token } = await response.json();
      links[role] = `http://127.0.0.1:5173/#annoteer=${token}`;
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(links));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message }));
  }
};
const server = await createServer({
  root: fileURLToPath(new URL("../apps/playground", import.meta.url)),
  configFile: fileURLToPath(new URL("../apps/playground/vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "annoteer-demo",
      configureServer(server) {
        server.middlewares.use("/__annoteer_demo", demoMiddleware);
      },
    },
  ],
});
await server.listen();
console.log(
  "\n  ↗ Annoteer demo: http://127.0.0.1:5173\n  Local Worker + D1: http://127.0.0.1:8787\n",
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
  await worker.dispose();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);

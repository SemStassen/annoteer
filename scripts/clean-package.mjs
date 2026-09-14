import { rm } from "node:fs/promises";
// Clear once before Vite+ runs its three independent packaging jobs.
await rm(new URL("../packages/annoteer/dist/", import.meta.url), { recursive: true, force: true });
await rm(new URL("../packages/annoteer/template/", import.meta.url), {
  recursive: true,
  force: true,
});

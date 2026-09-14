import { cp, mkdir, chmod } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("package/template", root), { recursive: true });
await cp(new URL("worker/alchemy.run.ts", root), new URL("package/template/alchemy.run.ts", root));
await cp(new URL("worker/migrations", root), new URL("package/template/migrations", root), {
  recursive: true,
});
await cp(new URL("README.md", root), new URL("package/README.md", root));
await cp(new URL("LICENSE", root), new URL("package/LICENSE", root));
await chmod(new URL("package/dist/cli/index.mjs", root), 0o755);

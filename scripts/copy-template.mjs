import { cp, mkdir, chmod } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("packages/annoteer/template", root), { recursive: true });
await cp(
  new URL("packages/annoteer/infrastructure/alchemy.run.ts", root),
  new URL("packages/annoteer/template/alchemy.run.ts", root),
);
await cp(
  new URL("packages/annoteer/infrastructure/migrations", root),
  new URL("packages/annoteer/template/migrations", root),
  {
    recursive: true,
  },
);
await cp(new URL("README.md", root), new URL("packages/annoteer/README.md", root));
await cp(new URL("LICENSE", root), new URL("packages/annoteer/LICENSE", root));
await chmod(new URL("packages/annoteer/dist/cli/index.mjs", root), 0o755);

await cp(
  new URL("packages/annoteer/infrastructure/password.ts", root),
  new URL("packages/annoteer/template/password.ts", root),
);

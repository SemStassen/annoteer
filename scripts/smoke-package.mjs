import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const archive = fileURLToPath(new URL("../artifacts/annoteer-0.1.0.tgz", import.meta.url));
const cwd = await mkdtemp(join(tmpdir(), "annoteer-consumer-"));
const run = (bin, args) =>
  new Promise((ok, reject) => {
    const child = spawn(bin, args, { cwd, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? ok() : reject(new Error(`Consumer command failed: ${bin} (${code})`)),
    );
  });
try {
  await writeFile(
    join(cwd, "package.json"),
    JSON.stringify({ name: "annoteer-consumer-smoke", private: true, type: "module" }),
  );
  await run(process.platform === "win32" ? "npm.cmd" : "npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    archive,
  ]);
  await writeFile(
    join(cwd, "ssr.mjs"),
    `import assert from 'node:assert/strict';\nimport React from 'react';\nimport { renderToString } from 'react-dom/server';\nimport { Annoteer } from 'annoteer';\nimport { Annoteer as Alias } from 'annoteer/react';\nassert.equal(Annoteer, Alias);\nassert.equal(renderToString(React.createElement(Annoteer, {endpoint:'https://feedback.example'})), '');\n`,
  );
  await run(process.execPath, ["ssr.mjs"]);
  const args = [
    "node_modules/annoteer/dist/cli/index.mjs",
    "init",
    "--site",
    "https://preview.example",
    "--name",
    "annoteer-smoke",
    "--skip-install",
    "--skip-deploy",
  ];
  await run(process.execPath, args);
  const before = await readFile(join(cwd, ".annoteer/secrets.json"), "utf8");
  await run(process.execPath, args);
  assert.equal(await readFile(join(cwd, ".annoteer/secrets.json"), "utf8"), before);
  assert.match(await readFile(join(cwd, ".gitignore"), "utf8"), /\.annoteer/);
  await access(join(cwd, ".annoteer/worker/index.js"));
  await access(join(cwd, ".annoteer/migrations/0001_initial.sql"));
  console.log(
    "✓ Packed package installs, renders safely on the server, and scaffolds/resumes from its own shipped assets.",
  );
} finally {
  await rm(cwd, { recursive: true, force: true });
}

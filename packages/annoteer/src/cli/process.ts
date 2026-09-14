import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { operation } from "./errors";

export const command = (file: string, args: string[], cwd: string) =>
  operation(
    () =>
      new Promise<void>((ok, reject) => {
        const child = spawn(file, args, { cwd, stdio: "inherit", shell: false });
        child.once("error", reject);
        child.once("exit", (code, signal) =>
          code === 0
            ? ok()
            : reject(
                new Error(
                  `${file} ${args[0]} failed (${signal ?? code}). Fix the error above, then rerun the command to resume.`,
                ),
              ),
        );
      }),
  );
export const ask = (prompt: string, fallback?: string) =>
  operation(async () => {
    if (!process.stdin.isTTY)
      throw new Error(
        `Missing ${prompt}. Provide --site and --name when running non-interactively.`,
      );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (
        (await rl.question(`${prompt}${fallback ? ` (${fallback})` : ""}: `)).trim() ||
        fallback ||
        ""
      );
    } finally {
      rl.close();
    }
  });

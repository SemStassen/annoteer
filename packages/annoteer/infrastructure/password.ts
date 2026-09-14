import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { parse, type ParseError } from "jsonc-parser";
import { readFile, writeFile } from "node:fs/promises";

export function validateReviewPassword(password: unknown): asserts password is string | undefined {
  if (password === undefined) return;
  if (
    typeof password !== "string" ||
    password.trim().length < 8 ||
    new TextEncoder().encode(password).length > 72
  ) {
    throw new Error(
      "The config password must contain at least 8 non-padding characters and at most 72 UTF-8 bytes. Remove the password field to disable it.",
    );
  }
}

// Preserve the salt across unchanged deployments so sessions stay valid.
export async function prepareReviewPassword(password: unknown, path = "./review-password.json") {
  validateReviewPassword(password);
  let previous: { passwordHash: string; passwordVersion: string } | undefined;
  try {
    const stored = JSON.parse(await readFile(path, "utf8")) as {
      passwordHash?: unknown;
      passwordVersion?: unknown;
    };
    if (typeof stored.passwordHash !== "string")
      throw new Error("Invalid private review-password.json.");
    if (typeof stored.passwordVersion === "string")
      previous = { passwordHash: stored.passwordHash, passwordVersion: stored.passwordVersion };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    previous &&
    ((password === undefined && previous.passwordHash === "") ||
      (password !== undefined &&
        /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(previous.passwordHash) &&
        (await compare(password, previous.passwordHash))))
  )
    return previous;
  const settings = {
    passwordHash: password === undefined ? "" : await hash(password, 10),
    passwordVersion: randomUUID(),
  };
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
  return settings;
}

export async function readReviewConfig(path = "../annoteer.jsonc"): Promise<{ password?: string }> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  const errors: ParseError[] = [];
  const config: unknown = parse(source, errors, { allowTrailingComma: true });
  if (errors.length || typeof config !== "object" || config === null || Array.isArray(config))
    throw new Error("Invalid annoteer.jsonc: expected a JSONC object.");
  if (Object.keys(config).some((key) => key !== "password"))
    throw new Error("Unknown setting in annoteer.jsonc. Currently only password is supported.");
  const password: unknown = "password" in config ? config.password : undefined;
  validateReviewPassword(password);
  return password === undefined ? {} : { password };
}

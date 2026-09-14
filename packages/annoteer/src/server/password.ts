import { compare } from "bcryptjs";
import type { Env } from "./env";
import { attempt } from "./errors";
import { hash } from "./credentials";

export const passwordVersion = (env: Env) =>
  hash(env.REVIEW_PASSWORD_VERSION ?? env.REVIEW_PASSWORD_HASH ?? "");
export const verifyPassword = (password: string, env: Env) =>
  attempt(() => compare(password, env.REVIEW_PASSWORD_HASH ?? ""));

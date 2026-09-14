import { compare } from "bcryptjs";
/** Deployment-owned client password settings, independent of Cloudflare bindings. */
export interface ReviewPolicy {
  passwordHash?: string;
  passwordVersion?: string;
}
import { attempt } from "./errors";
import { hash } from "./credentials";

export const passwordVersion = (policy: ReviewPolicy) =>
  hash(policy.passwordVersion ?? policy.passwordHash ?? "");
export const verifyPassword = (password: string, policy: ReviewPolicy) =>
  attempt(() => compare(password, policy.passwordHash ?? ""));

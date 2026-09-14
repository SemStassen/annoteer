import { Effect } from "effect";
import { ReviewAccessSchema, SessionSchema } from "../domain/schema";
import { Database } from "./database";
import { fail } from "./errors";
import { hash, token } from "./credentials";
import { json, decode, readBody } from "./http";
import { passwordVersion, verifyPassword, type ReviewPolicy } from "./password";

/** Invitation exchange and password checks, including persistent attempt limits. */
export const sessionRoutes = (request: Request, policy: ReviewPolicy) =>
  Effect.gen(function* () {
    const { first, run } = yield* Database;
    const url = new URL(request.url);
    const now = Date.now();
    if (url.pathname === "/review-access" && request.method === "POST") {
      const body = yield* decode(ReviewAccessSchema, yield* readBody(request));
      const invitation = yield* first<{ role: string }>(
        "SELECT role FROM invitations WHERE token_hash = ? AND revoked = 0 AND expires_at > ?",
        yield* hash(body.token),
        now,
      );
      if (!invitation)
        return yield* Effect.fail(fail(401, "This review link has expired or was revoked."));
      return json({
        passwordRequired: invitation.role === "client" && Boolean(policy.passwordHash),
      });
    }
    if (url.pathname === "/sessions" && request.method === "POST") {
      const body = yield* decode(SessionSchema, yield* readBody(request));
      const invitation = yield* first<{ id: string; role: string; expires_at: number }>(
        "SELECT id, role, expires_at FROM invitations WHERE token_hash = ? AND revoked = 0 AND expires_at > ?",
        yield* hash(body.token),
        now,
      );
      if (!invitation)
        return yield* Effect.fail(fail(401, "This review link has expired or was revoked."));
      if (invitation.role === "client" && policy.passwordHash) {
        if (!body.password)
          return yield* Effect.fail(fail(401, "Enter the review password to continue."));
        const key = yield* hash(
          `${invitation.id}:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`,
        );
        yield* run("DELETE FROM password_attempts WHERE reset_at <= ?", now);
        const attempts = yield* first<{ attempts: number }>(
          "INSERT INTO password_attempts (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
          key,
          now + 15 * 60000,
        );
        if (!attempts || attempts.attempts > 10)
          return yield* Effect.fail(
            fail(429, "Too many password attempts. Try again in 15 minutes."),
          );
        if (!(yield* verifyPassword(body.password, policy)))
          return yield* Effect.fail(fail(401, "Incorrect review password. Please try again."));
      }
      const version = invitation.role === "client" ? yield* passwordVersion(policy) : "";
      const count = yield* first<{ total: number }>(
        "SELECT COUNT(*) AS total FROM sessions WHERE invitation_id = ? AND created_at > ?",
        invitation.id,
        now - 3600000,
      );
      if ((count?.total ?? 0) >= 100)
        return yield* Effect.fail(fail(429, "Too many review sessions. Please try again later."));
      const secret = token();
      const expiresAt = Math.min(invitation.expires_at, now + 7 * 86400000);
      yield* run(
        "INSERT INTO sessions (id, token_hash, invitation_id, name, expires_at, created_at, password_version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        crypto.randomUUID(),
        yield* hash(secret),
        invitation.id,
        body.name.trim(),
        expiresAt,
        now,
        version,
      );
      return json({ token: secret, name: body.name.trim(), role: invitation.role, expiresAt }, 201);
    }
    return yield* Effect.fail(fail(404, "Route not found."));
  });

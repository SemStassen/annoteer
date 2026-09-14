import { Effect } from "effect";
import { InviteSchema } from "../domain/schema";
import { Database } from "./database";
import { fail } from "./errors";
import { hash, token } from "./credentials";
import { json, decode, readBody } from "./http";

/** Agency-only invitation creation, listing, and revocation. */
export const invitationRoutes = (request: Request) =>
  Effect.gen(function* () {
    const { run, all } = yield* Database;
    const url = new URL(request.url);
    const now = Date.now();
    if (url.pathname === "/admin/invitations" && request.method === "POST") {
      const body = yield* decode(InviteSchema, yield* readBody(request));
      const secret = token();
      const id = crypto.randomUUID();
      const expiresAt = now + body.days * 86400000;
      yield* run(
        "INSERT INTO invitations (id, token_hash, label, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        yield* hash(secret),
        body.label.trim(),
        body.role,
        expiresAt,
        now,
      );
      return json({ id, token: secret, role: body.role, expiresAt }, 201);
    }
    if (url.pathname === "/admin/invitations" && request.method === "GET") {
      const rows = yield* all(
        "SELECT id, label, role, expires_at AS expiresAt, revoked, created_at AS createdAt FROM invitations ORDER BY created_at DESC LIMIT 500",
      );
      return json(rows);
    }
    const revoke = url.pathname.match(/^\/admin\/invitations\/([\w-]+)$/);
    if (revoke && request.method === "DELETE") {
      yield* run("UPDATE invitations SET revoked = 1 WHERE id = ?", revoke[1]);
      return json({ ok: true });
    }
    return yield* Effect.fail(fail(404, "Route not found."));
  });

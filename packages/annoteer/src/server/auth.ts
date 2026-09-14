import { Effect } from "effect";
import { Database } from "./database";
import { fail } from "./errors";
import { hash } from "./credentials";
import { passwordVersion, type ReviewPolicy } from "./password";

/** A session checked against its invitation and the current password policy. */
export interface Auth {
  id: string;
  name: string;
  role: "agency" | "client";
  expires_at: number;
  password_version: string;
}
/** Extracts only supported bearer credentials. */
export const bearerToken = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
/** Requires the private agency credential before dispatching any admin route. */
export const requireAgency = (bearer: string | undefined, adminToken: string | undefined) =>
  Effect.gen(function* () {
    if (!bearer || !adminToken || (yield* hash(bearer)) !== (yield* hash(adminToken)))
      return yield* Effect.fail(fail(401, "Agency credentials required."));
  });
/** Revocation and password policy are rechecked on every authenticated request. */
export const authenticate = (bearer: string | undefined, policy: ReviewPolicy) =>
  Effect.gen(function* () {
    const { first } = yield* Database;
    const now = Date.now();
    if (!bearer) return yield* Effect.fail(fail(401, "Open a review invitation to continue."));
    const auth = yield* first<Auth>(
      "SELECT s.id, s.name, s.expires_at, s.password_version, i.role FROM sessions s JOIN invitations i ON i.id = s.invitation_id WHERE s.token_hash = ? AND s.expires_at > ? AND i.expires_at > ? AND i.revoked = 0",
      yield* hash(bearer),
      now,
      now,
    );
    if (!auth)
      return yield* Effect.fail(fail(401, "Your review session has expired or was revoked."));
    if (auth.role === "client" && auth.password_version !== (yield* passwordVersion(policy)))
      return yield* Effect.fail(
        fail(401, "The review password has changed. Reopen your invitation link."),
      );
    return auth;
  });

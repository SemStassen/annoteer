import { Effect } from "effect";
import { Database } from "./database";
import { bearerToken, requireAgency, authenticate } from "./auth";
import { invitationRoutes } from "./invitations";
import { sessionRoutes } from "./sessions";
import { annotationRoutes } from "./annotations";
import { json } from "./http";
import type { ReviewPolicy } from "./password";

/** Dispatches features after enforcing their authentication boundary. */
export const route = (request: Request, policy: ReviewPolicy, adminToken?: string) =>
  Effect.gen(function* () {
    const url = new URL(request.url);
    const bearer = bearerToken(request);
    if (url.pathname === "/health" && request.method === "GET") {
      const db = yield* Database;
      yield* db.first("SELECT 1 FROM invitations LIMIT 1");
      return json({ ok: true, name: "annoteer" });
    }
    if (url.pathname.startsWith("/admin/")) {
      yield* requireAgency(bearer, adminToken);
      return yield* invitationRoutes(request);
    }
    if (["/review-access", "/sessions"].includes(url.pathname) && request.method === "POST")
      return yield* sessionRoutes(request, policy);
    const auth = yield* authenticate(bearer, policy);
    if (url.pathname === "/session" && request.method === "GET")
      return json({ name: auth.name, role: auth.role, expiresAt: auth.expires_at });
    return yield* annotationRoutes(request, auth);
  });

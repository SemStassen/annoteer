import type { D1Database } from "@cloudflare/workers-types";
import { Data, Effect, Schema } from "effect";
import {
  CreateAnnotationSchema,
  InviteSchema,
  ReplySchema,
  SessionSchema,
  StatusSchema,
} from "../../shared/schema";

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGINS: string;
}
class ApiError extends Data.TaggedError("ApiError")<{ status: number; message: string }> {}
const fail = (status: number, message: string) => new ApiError({ status, message });
const attempt = <T>(run: () => Promise<T>) =>
  Effect.tryPromise({
    try: run,
    catch: () => fail(500, "Unable to complete the request. Please try again."),
  });
const hash = (value: string) =>
  attempt(async () =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
  );
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const json = (data: unknown, status = 200) => Response.json(data, { status });
const decode = <A, I>(schema: Schema.Schema<A, I>, input: unknown) =>
  Schema.decodeUnknown(schema)(input).pipe(
    Effect.mapError(() => fail(400, "Invalid request fields.")),
  );
const readBody = (request: Request) =>
  Effect.tryPromise({
    try: async () => {
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw fail(415, "Expected application/json.");
      const reader = request.body?.getReader();
      if (!reader) throw fail(400, "Expected a JSON body.");
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          throw fail(413, "Request is too large.");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    },
    catch: (error) => (error instanceof ApiError ? error : fail(400, "Invalid JSON body.")),
  });
interface Auth {
  id: string;
  name: string;
  role: "agency" | "client";
  expires_at: number;
}
interface AnnotationRow {
  id: string;
  path: string;
  deployment: string;
  anchor: string;
  body: string;
  author: string;
  status: string;
  created_at: number;
}
interface ReplyRow {
  id: string;
  annotation_id: string;
  author: string;
  role: string;
  body: string;
  created_at: number;
}

export const route = (request: Request, env: Env) =>
  Effect.gen(function* () {
    const url = new URL(request.url);
    const now = Date.now();
    const bearer = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const first = <T>(sql: string, ...args: unknown[]) =>
      attempt(() =>
        env.DB.prepare(sql)
          .bind(...args)
          .first<T>(),
      );
    const run = (sql: string, ...args: unknown[]) =>
      attempt(() =>
        env.DB.prepare(sql)
          .bind(...args)
          .run(),
      );
    if (url.pathname === "/health" && request.method === "GET") {
      yield* first("SELECT 1 FROM invitations LIMIT 1");
      return json({ ok: true, name: "annoteer" });
    }
    if (url.pathname.startsWith("/admin/")) {
      if (!bearer || !env.ADMIN_TOKEN || (yield* hash(bearer)) !== (yield* hash(env.ADMIN_TOKEN)))
        return yield* Effect.fail(fail(401, "Agency credentials required."));
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
        const rows = yield* attempt(() =>
          env.DB.prepare(
            "SELECT id, label, role, expires_at AS expiresAt, revoked, created_at AS createdAt FROM invitations ORDER BY created_at DESC LIMIT 500",
          ).all(),
        );
        return json(rows.results);
      }
      const revoke = url.pathname.match(/^\/admin\/invitations\/([\w-]+)$/);
      if (revoke && request.method === "DELETE") {
        yield* run("UPDATE invitations SET revoked = 1 WHERE id = ?", revoke[1]);
        return json({ ok: true });
      }
      return yield* Effect.fail(fail(404, "Route not found."));
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
        "INSERT INTO sessions (id, token_hash, invitation_id, name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        crypto.randomUUID(),
        yield* hash(secret),
        invitation.id,
        body.name.trim(),
        expiresAt,
        now,
      );
      return json({ token: secret, name: body.name.trim(), role: invitation.role, expiresAt }, 201);
    }
    if (!bearer) return yield* Effect.fail(fail(401, "Open a review invitation to continue."));
    const auth = yield* first<Auth>(
      "SELECT s.id, s.name, s.expires_at, i.role FROM sessions s JOIN invitations i ON i.id = s.invitation_id WHERE s.token_hash = ? AND s.expires_at > ? AND i.expires_at > ? AND i.revoked = 0",
      yield* hash(bearer),
      now,
      now,
    );
    if (!auth)
      return yield* Effect.fail(fail(401, "Your review session has expired or was revoked."));
    if (url.pathname === "/session" && request.method === "GET")
      return json({ name: auth.name, role: auth.role, expiresAt: auth.expires_at });
    if (url.pathname === "/annotations" && request.method === "GET") {
      const deployment = url.searchParams.get("deployment") ?? "main";
      const path = url.searchParams.get("path");
      const rows = yield* attempt(() =>
        env.DB.prepare(
          "SELECT * FROM annotations WHERE deployment = ? AND (? IS NULL OR path = ?) ORDER BY created_at DESC LIMIT 500",
        )
          .bind(deployment, path, path)
          .all<AnnotationRow>(),
      );
      const ids = rows.results.map((row) => row.id);
      const replies = ids.length
        ? (yield* attempt(() =>
            env.DB.prepare(
              "SELECT * FROM replies WHERE annotation_id IN (SELECT id FROM annotations WHERE deployment = ? AND (? IS NULL OR path = ?) ORDER BY created_at DESC LIMIT 500) ORDER BY created_at",
            )
              .bind(deployment, path, path)
              .all<ReplyRow>(),
          )).results
        : [];
      return json(
        rows.results.map((row) => ({
          id: row.id,
          path: row.path,
          deployment: row.deployment,
          anchor: JSON.parse(row.anchor),
          body: row.body,
          author: row.author,
          status: row.status,
          createdAt: row.created_at,
          replies: replies
            .filter((reply) => reply.annotation_id === row.id)
            .map((reply) => ({
              id: reply.id,
              author: reply.author,
              role: reply.role,
              body: reply.body,
              createdAt: reply.created_at,
            })),
        })),
      );
    }
    if (url.pathname === "/annotations" && request.method === "POST") {
      const body = yield* decode(CreateAnnotationSchema, yield* readBody(request));
      const count = yield* first<{ total: number }>(
        "SELECT COUNT(*) AS total FROM annotations WHERE session_id = ? AND created_at > ?",
        auth.id,
        now - 3600000,
      );
      if ((count?.total ?? 0) >= 100)
        return yield* Effect.fail(
          fail(429, "You have added a lot of feedback. Please try again later."),
        );
      const id = crypto.randomUUID();
      yield* run(
        "INSERT INTO annotations (id, session_id, path, deployment, anchor, body, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        auth.id,
        body.path,
        body.deployment,
        JSON.stringify(body.anchor),
        body.body.trim(),
        auth.name,
        now,
      );
      return json({ id }, 201);
    }
    const match = url.pathname.match(/^\/annotations\/([\w-]+)(\/replies)?$/);
    if (match) {
      const existing = yield* first<{ id: string }>(
        "SELECT id FROM annotations WHERE id = ?",
        match[1],
      );
      if (!existing) return yield* Effect.fail(fail(404, "Annotation not found."));
      if (match[2] && request.method === "POST") {
        const body = yield* decode(ReplySchema, yield* readBody(request));
        const count = yield* first<{ total: number }>(
          "SELECT COUNT(*) AS total FROM replies WHERE session_id = ? AND created_at > ?",
          auth.id,
          now - 3600000,
        );
        if ((count?.total ?? 0) >= 200)
          return yield* Effect.fail(fail(429, "Too many replies. Please try again later."));
        const id = crypto.randomUUID();
        yield* run(
          "INSERT INTO replies (id, annotation_id, session_id, author, role, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          id,
          match[1],
          auth.id,
          auth.name,
          auth.role,
          body.body.trim(),
          now,
        );
        return json({ id }, 201);
      }
      if (!match[2] && request.method === "PATCH") {
        if (auth.role !== "agency")
          return yield* Effect.fail(fail(403, "Only the agency can resolve feedback."));
        const body = yield* decode(StatusSchema, yield* readBody(request));
        yield* run("UPDATE annotations SET status = ? WHERE id = ?", body.status, match[1]);
        return json({ ok: true });
      }
    }
    return yield* Effect.fail(fail(404, "Route not found."));
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((entry) => entry.trim());
    if (origin && !allowed.includes(origin)) return json({ error: "Origin not allowed." }, 403);
    const response =
      request.method === "OPTIONS"
        ? new Response(null, { status: 204 })
        : await Effect.runPromise(
            route(request, env).pipe(
              Effect.catchAll((error) =>
                Effect.succeed(json({ error: error.message }, error.status)),
              ),
              Effect.catchAllDefect(() =>
                Effect.succeed(json({ error: "An unexpected error occurred." }, 500)),
              ),
            ),
          );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Vary", "Origin");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    return response;
  },
};

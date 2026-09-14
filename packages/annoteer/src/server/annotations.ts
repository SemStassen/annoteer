import { Effect } from "effect";
import { CreateAnnotationSchema, ReplySchema, StatusSchema } from "../domain/schema";
import { Database } from "./database";
import type { Auth } from "./auth";
import { fail } from "./errors";
import { json, decode, readBody } from "./http";

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

/** Feedback queries, writes, replies, and agency-only status changes. */
export const annotationRoutes = (request: Request, auth: Auth) =>
  Effect.gen(function* () {
    const { first, run, all } = yield* Database;
    const url = new URL(request.url);
    const now = Date.now();
    if (url.pathname === "/annotations" && request.method === "GET") {
      const deployment = url.searchParams.get("deployment") ?? "main";
      const path = url.searchParams.get("path");
      const rows = yield* all<AnnotationRow>(
        "SELECT * FROM annotations WHERE deployment = ? AND (? IS NULL OR path = ?) ORDER BY created_at DESC LIMIT 500",
        deployment,
        path,
        path,
      );
      const ids = rows.map((row) => row.id);
      const replies = ids.length
        ? yield* all<ReplyRow>(
            "SELECT * FROM replies WHERE annotation_id IN (SELECT id FROM annotations WHERE deployment = ? AND (? IS NULL OR path = ?) ORDER BY created_at DESC LIMIT 500) ORDER BY created_at",
            deployment,
            path,
            path,
          )
        : [];
      return json(
        rows.map((row) => ({
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

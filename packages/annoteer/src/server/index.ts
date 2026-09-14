import { Effect } from "effect";
import type { Env } from "./env";
import { route } from "./router";
import { d1DatabaseLayer } from "./database";
import { json } from "./http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((entry) => entry.trim());
    if (origin && !allowed.includes(origin)) return json({ error: "Origin not allowed." }, 403);
    const response =
      request.method === "OPTIONS"
        ? new Response(null, { status: 204 })
        : await Effect.runPromise(
            route(
              request,
              {
                passwordHash: env.REVIEW_PASSWORD_HASH,
                passwordVersion: env.REVIEW_PASSWORD_VERSION,
              },
              env.ADMIN_TOKEN,
            ).pipe(
              Effect.provide(d1DatabaseLayer(env.DB)),
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

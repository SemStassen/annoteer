import type { D1Database } from "@cloudflare/workers-types";
import { Context, Effect, Layer } from "effect";
import { attempt, type ApiError } from "./errors";

/** SQL operations used by the feedback modules; failures use the API error channel. */
export class Database extends Context.Tag("annoteer/Database")<
  Database,
  {
    readonly first: <T>(sql: string, ...args: unknown[]) => Effect.Effect<T | null, ApiError>;
    readonly all: <T>(sql: string, ...args: unknown[]) => Effect.Effect<T[], ApiError>;
    readonly run: (sql: string, ...args: unknown[]) => Effect.Effect<void, ApiError>;
  }
>() {}

/** Adapts this Worker's D1 binding without exposing it to request handlers. */
export const d1DatabaseLayer = (binding: D1Database) =>
  Layer.succeed(Database, {
    first: <T>(sql: string, ...args: unknown[]) =>
      attempt(() =>
        binding
          .prepare(sql)
          .bind(...args)
          .first<T>(),
      ),
    all: <T>(sql: string, ...args: unknown[]) =>
      attempt(
        async () =>
          (
            await binding
              .prepare(sql)
              .bind(...args)
              .all<T>()
          ).results,
      ),
    run: (sql: string, ...args: unknown[]) =>
      attempt(async () => {
        await binding
          .prepare(sql)
          .bind(...args)
          .run();
      }),
  });

import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGINS: string;
}

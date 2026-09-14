import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  REVIEW_PASSWORD_HASH?: string;
  REVIEW_PASSWORD_VERSION?: string;
  ALLOWED_ORIGINS: string;
}

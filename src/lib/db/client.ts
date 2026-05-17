/**
 * Neon serverless Postgres client + Drizzle binding.
 *
 * Use the pooled URL (DATABASE_URL) for app requests; the unpooled URL is for
 * migrations and the offline smoke test only.
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

neonConfig.fetchConnectionCache = true;

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing. Set it in .env.local. Neon docs: https://vercel.com/marketplace/neon",
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };

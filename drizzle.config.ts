/**
 * Drizzle config. Schema lives in src/lib/db/schema.ts; migrations are
 * generated into drizzle/ and applied with `npm run db:migrate`.
 *
 * Required env: DATABASE_URL_UNPOOLED (or DATABASE_URL).
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "drizzle-kit";

for (const f of [".env.local", ".env"]) {
  const p = join(process.cwd(), f);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

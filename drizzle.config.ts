/**
 * Drizzle config. Schema lives in src/lib/db/schema.ts; migrations are
 * generated into drizzle/ and applied with `npm run db:migrate`.
 *
 * Required env: DATABASE_URL_UNPOOLED (or DATABASE_URL).
 */

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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

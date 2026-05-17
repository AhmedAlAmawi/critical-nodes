/**
 * Apply every SQL migration file in drizzle/ alphabetically, against
 * DATABASE_URL_UNPOOLED (or DATABASE_URL). Idempotent — every CREATE in
 * our migrations uses IF NOT EXISTS.
 *
 * We can't use drizzle-kit's built-in `migrate` because the pgvector
 * extension must exist before drizzle's CREATE TABLE for source_chunk_vec
 * runs, and drizzle-kit doesn't model extensions.
 */

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required.");
    process.exit(2);
  }
  const sql = neon(url);

  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Applying ${files.length} migration file(s) from drizzle/`);
  for (const f of files) {
    console.log(`  → ${f}`);
    const body = readFileSync(join(dir, f), "utf8");
    // Some drizzle migrations use --> statement-breakpoint as a separator.
    const statements = body
      .split(/-->\s*statement-breakpoint/i)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await sql.query(stmt);
      } catch (err) {
        const msg = (err as Error).message;
        // "already exists" is fine — our migrations are designed to be
        // idempotent but Drizzle-emitted DDL doesn't always include IF NOT
        // EXISTS for foreign keys.
        if (/already exists/i.test(msg) || /duplicate/i.test(msg)) {
          console.log(`    (skipped: ${msg.slice(0, 100)})`);
          continue;
        }
        console.error(`    ERROR on stmt:\n${stmt.slice(0, 200)}\n`);
        throw err;
      }
    }
  }

  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

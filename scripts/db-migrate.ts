/**
 * Apply every SQL migration file in drizzle/ alphabetically, against
 * DATABASE_URL_UNPOOLED (or DATABASE_URL). Idempotent — every CREATE in
 * our migrations uses IF NOT EXISTS.
 *
 * We can't use drizzle-kit's built-in `migrate` because the pgvector
 * extension must exist before drizzle's CREATE TABLE for source_chunk_vec
 * runs, and drizzle-kit doesn't model extensions.
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

// Load .env.local first (Next.js convention), fall back to .env.
const cwd = process.cwd();
for (const f of [".env.local", ".env"]) {
  const p = join(cwd, f);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

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

    // Strip SQL line comments so they don't confuse the simple ; splitter
    // we fall back to when there's no drizzle "--> statement-breakpoint".
    // Important: only strip `-- ` (real SQL comments) — NEVER `-->` because
    // that's drizzle's statement separator marker.
    const cleaned = body
      .split("\n")
      .map((l) => l.replace(/^\s*--(?!>).*$/, ""))
      .join("\n");

    // Drizzle-generated migrations use --> statement-breakpoint between
    // statements. Hand-written ones (extensions, pgvector indexes) don't —
    // for those, fall back to splitting on `;` at end-of-statement.
    const hasMarker = /-->\s*statement-breakpoint/i.test(cleaned);
    const statements = (hasMarker
      ? cleaned.split(/-->\s*statement-breakpoint/i)
      : cleaned.split(/;\s*\n/)
    )
      .map((s) => s.trim().replace(/;\s*$/, ""))
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

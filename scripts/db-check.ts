/**
 * Lightweight DB diagnostic — confirms the v3 schema is in place.
 * Run: `npx tsx scripts/db-check.ts`
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

for (const f of [".env.local", ".env"]) {
  const p = join(process.cwd(), f);
  if (existsSync(p)) loadEnv({ path: p, override: false });
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing.");
    process.exit(2);
  }
  const sql = neon(url);

  const ext = (await sql`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `) as Array<{ extname: string }>;
  console.log(
    ext[0] ? "✓ pgvector extension installed" : "✗ pgvector extension MISSING",
  );

  const expected = [
    "users", "courses", "enrollments",
    "sources", "source_chunks", "source_chunk_vec",
    "assignments", "sessions", "session_node_state",
    "mentor_messages", "renders", "evaluations", "events",
  ];
  const present = (await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `) as Array<{ tablename: string }>;
  const set = new Set(present.map((r) => r.tablename));
  for (const t of expected) {
    console.log(set.has(t) ? `✓ ${t}` : `✗ ${t} MISSING`);
  }

  const indexes = (await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('idx_source_chunk_vec_ivf', 'idx_source_chunks_text_fts')
  `) as Array<{ indexname: string }>;
  for (const name of ["idx_source_chunk_vec_ivf", "idx_source_chunks_text_fts"]) {
    console.log(
      indexes.some((i) => i.indexname === name)
        ? `✓ index ${name}`
        : `✗ index ${name} MISSING`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

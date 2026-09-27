/**
 * GET /api/health — deploy verification. Public, secret-free.
 *
 * Reports which integrations are configured (booleans only), which Neon host
 * the deployment talks to, and whether the v3 schema is present there.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_TABLES = [
  "users", "courses", "enrollments",
  "sources", "source_chunks", "source_chunk_vec",
  "assignments", "sessions", "session_node_state",
  "mentor_messages", "renders", "evaluations", "events",
];

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/@([^/?:]+)/);
  return m ? m[1] : "(unparsed)";
}

export async function GET(): Promise<NextResponse> {
  const env = {
    database: !!process.env.DATABASE_URL,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    clerkSecret: !!process.env.CLERK_SECRET_KEY,
    clerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkKeyMode: (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_live")
      ? "live"
      : (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test")
        ? "test"
        : null,
    gemini: !!process.env.GEMINI_API_KEY,
    jina: !!process.env.JINA_API_KEY,
    instructorCode: !!process.env.INSTRUCTOR_CODE,
  };

  let db: {
    ok: boolean;
    host: string | null;
    pgvector: boolean;
    tables: number;
    missing: string[];
    error?: string;
  } = { ok: false, host: hostOf(process.env.DATABASE_URL), pgvector: false, tables: 0, missing: EXPECTED_TABLES };

  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      const ext = (await sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`) as Array<{ extname: string }>;
      const present = (await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`) as Array<{ tablename: string }>;
      const set = new Set(present.map((r) => r.tablename));
      const missing = EXPECTED_TABLES.filter((t) => !set.has(t));
      db = {
        ok: missing.length === 0 && ext.length > 0,
        host: db.host,
        pgvector: ext.length > 0,
        tables: EXPECTED_TABLES.length - missing.length,
        missing,
      };
    } catch (err) {
      db = { ...db, error: (err as Error).message.slice(0, 200) };
    }
  }

  const ok = db.ok && env.blob && env.clerkSecret && env.clerkPublishable;
  return NextResponse.json(
    {
      ok,
      version: "v3",
      env,
      db,
      vercel: {
        env: process.env.VERCEL_ENV ?? null,
        region: process.env.VERCEL_REGION ?? null,
        sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

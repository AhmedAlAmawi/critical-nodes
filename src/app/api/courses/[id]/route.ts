/**
 * GET /api/courses/[id] — course detail with stats.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const { id } = await ctx.params;
  const courseId = parseInt(id, 10);
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT id, title, code, slug, created_at FROM courses
    WHERE id = ${courseId} AND owner_id = ${user.id}
  `) as Array<Record<string, unknown>>;
  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const sources = await sql`
    SELECT id, kind, title, page_count, ingest_status, ingest_error,
      (SELECT COUNT(*) FROM source_chunks WHERE source_id = sources.id) AS chunk_count,
      created_at
    FROM sources WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `;
  const assignments = await sql`
    SELECT id, title, due_at, published_at, required_nodes, scope_source_ids
    FROM assignments WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({
    ok: true,
    course: rows[0],
    sources,
    assignments,
  });
}

/**
 * GET /api/courses/[id]/assignments — list a course's assignments.
 * POST /api/courses/[id]/assignments — create a new assignment.
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
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await sql`
    SELECT id, title, brief, scope_source_ids, scope_chunk_ids, required_nodes,
      rubric, due_at, published_at, created_at
    FROM assignments WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ ok: true, assignments: rows });
}

export async function POST(
  req: Request,
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
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    brief?: string;
    scopeSourceIds?: number[];
    scopeChunkIds?: number[];
    requiredNodes?: string[];
    rubric?: Record<string, unknown>;
    dueAt?: string | null;
    publish?: boolean;
  };

  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id FROM courses WHERE id = ${courseId} AND owner_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = (await sql`
    INSERT INTO assignments
      (course_id, title, brief, scope_source_ids, scope_chunk_ids,
       required_nodes, rubric, due_at, published_at)
    VALUES
      (${courseId},
       ${body.title},
       ${body.brief ?? null},
       ${body.scopeSourceIds ?? []}::bigint[],
       ${body.scopeChunkIds ?? []}::bigint[],
       ${body.requiredNodes ?? []}::text[],
       ${JSON.stringify(body.rubric ?? {})}::jsonb,
       ${body.dueAt ?? null},
       ${body.publish ? new Date().toISOString() : null})
    RETURNING id
  `) as Array<{ id: number }>;
  return NextResponse.json({ ok: true, assignmentId: Number(rows[0].id) });
}

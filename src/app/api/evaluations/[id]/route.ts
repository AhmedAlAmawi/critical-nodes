/**
 * GET /api/evaluations/[id] — fetch an evaluation.
 * PATCH /api/evaluations/[id] — faculty override scores and notes.
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
  const evalId = parseInt(id, 10);
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT e.* FROM evaluations e
    JOIN assignments a ON a.id = e.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE e.id = ${evalId} AND c.owner_id = ${user.id}
  `) as Array<Record<string, unknown>>;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, evaluation: rows[0] });
}

export async function PATCH(
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
  const evalId = parseInt(id, 10);
  const body = (await req.json().catch(() => ({}))) as {
    facultyOverrides?: Record<string, number>;
    facultyNotes?: string;
  };
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    UPDATE evaluations e
    SET faculty_overrides = ${JSON.stringify(body.facultyOverrides ?? {})}::jsonb,
        faculty_notes = ${body.facultyNotes ?? null}
    FROM assignments a, courses c
    WHERE e.id = ${evalId}
      AND a.id = e.assignment_id
      AND c.id = a.course_id
      AND c.owner_id = ${user.id}
  `;
  return NextResponse.json({ ok: true });
}

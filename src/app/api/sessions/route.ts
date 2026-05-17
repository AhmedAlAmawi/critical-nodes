/**
 * GET /api/sessions — list the current student's sessions.
 * POST /api/sessions — create a new session (optionally bound to an assignment).
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT s.id, s.status, s.started_at, s.ended_at,
           s.course_id, c.title AS course_title,
           s.assignment_id, a.title AS assignment_title
    FROM sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE s.student_id = ${user.id}
    ORDER BY s.started_at DESC
  `;
  return NextResponse.json({ ok: true, sessions: rows });
}

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as {
    assignmentId?: number | null;
    courseId?: number | null;
  };
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    INSERT INTO sessions (student_id, course_id, assignment_id)
    VALUES (${user.id}, ${body.courseId ?? null}, ${body.assignmentId ?? null})
    RETURNING id
  `) as Array<{ id: number }>;
  return NextResponse.json({ ok: true, sessionId: Number(rows[0].id) });
}

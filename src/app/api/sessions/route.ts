/**
 * GET /api/sessions — list the current student's sessions.
 * POST /api/sessions — create a new session (optionally bound to a course
 *                      and/or an assignment).
 *
 * A session always records its course when one can be derived (explicitly,
 * or via the assignment). That binding is what lets faculty find the
 * student's work in the cohort view and what scopes the RAG mentor.
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

  let courseId: number | null = body.courseId ?? null;
  let assignmentId: number | null = body.assignmentId ?? null;

  if (assignmentId) {
    const a = (await sql`
      SELECT a.id, a.course_id FROM assignments a
      JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ${user.id}
      WHERE a.id = ${assignmentId} AND a.published_at IS NOT NULL
      LIMIT 1
    `) as Array<{ id: number; course_id: number }>;
    if (!a[0]) {
      return NextResponse.json(
        { error: "Assignment not found, not published, or you're not enrolled in its course." },
        { status: 404 },
      );
    }
    courseId = Number(a[0].course_id);
  } else if (courseId) {
    const e = (await sql`
      SELECT 1 FROM enrollments WHERE course_id = ${courseId} AND student_id = ${user.id} LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (!e[0]) {
      return NextResponse.json({ error: "You're not enrolled in that course." }, { status: 403 });
    }
  } else {
    // Freeform: if the student is enrolled in exactly one course, bind to it
    // so faculty can see the work and the mentor is grounded.
    const only = (await sql`
      SELECT course_id FROM enrollments WHERE student_id = ${user.id}
    `) as Array<{ course_id: number }>;
    if (only.length === 1) courseId = Number(only[0].course_id);
    assignmentId = null;
  }

  const rows = (await sql`
    INSERT INTO sessions (student_id, course_id, assignment_id)
    VALUES (${user.id}, ${courseId}, ${assignmentId})
    RETURNING id
  `) as Array<{ id: number }>;
  await sql`
    INSERT INTO events (actor_id, kind, payload)
    VALUES (${user.id}, 'session.create', ${JSON.stringify({ sessionId: Number(rows[0].id), courseId, assignmentId })}::jsonb)
  `;
  return NextResponse.json({ ok: true, sessionId: Number(rows[0].id) });
}

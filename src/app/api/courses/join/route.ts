/**
 * POST /api/courses/join — a student enrols in a course using its join code
 * (the course slug, shown to faculty on the course dashboard).
 *
 * Body: { code }. Idempotent: re-joining an enrolled course is a no-op.
 * This is the only enrolment path in v3 — without it the faculty cohort view
 * and assignment list are always empty.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim().toLowerCase();
  if (!code) {
    return NextResponse.json({ error: "Enter a course code." }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT id, title, code FROM courses
    WHERE lower(slug) = ${code} OR lower(coalesce(code, '')) = ${code}
    ORDER BY (lower(slug) = ${code}) DESC
    LIMIT 1
  `) as Array<{ id: number; title: string; code: string | null }>;
  if (!rows[0]) {
    return NextResponse.json({ error: "No course matches that code." }, { status: 404 });
  }
  const course = rows[0];
  await sql`
    INSERT INTO enrollments (course_id, student_id, joined_at)
    VALUES (${course.id}, ${user.id}, now())
    ON CONFLICT (course_id, student_id) DO UPDATE SET joined_at = coalesce(enrollments.joined_at, now())
  `;
  await sql`
    INSERT INTO events (actor_id, kind, payload)
    VALUES (${user.id}, 'course.join', ${JSON.stringify({ courseId: Number(course.id) })}::jsonb)
  `;
  return NextResponse.json({ ok: true, course: { id: Number(course.id), title: course.title } });
}

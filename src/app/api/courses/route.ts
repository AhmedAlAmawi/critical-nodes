/**
 * GET /api/courses — list courses for the current faculty user.
 * POST /api/courses — create a new course.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export async function GET(): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT c.id, c.title, c.code, c.slug, c.created_at,
      (SELECT COUNT(*) FROM sources WHERE course_id = c.id) AS source_count,
      (SELECT COUNT(*) FROM assignments WHERE course_id = c.id) AS assignment_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS enrollment_count
    FROM courses c WHERE c.owner_id = ${user.id}
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json({ ok: true, courses: rows });
}

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    code?: string;
  };
  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    INSERT INTO courses (owner_id, title, slug, code)
    VALUES (${user.id}, ${body.title}, ${slugify(body.title)}, ${body.code ?? null})
    RETURNING id, slug
  `) as Array<{ id: number; slug: string }>;
  return NextResponse.json({ ok: true, course: rows[0] });
}

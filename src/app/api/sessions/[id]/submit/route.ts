/**
 * POST /api/sessions/[id]/submit — the student locks the session as their
 * final record: status → 'submitted', ended_at → now(). Idempotent.
 * Also writes an `events` row so faculty tooling can react to submissions.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const { id } = await ctx.params;
  const sessionId = parseInt(id, 10);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT id, status FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{ id: number; status: string }>;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (rows[0].status !== "active") {
    return NextResponse.json({ ok: true, status: rows[0].status, alreadySubmitted: true });
  }

  await sql`
    UPDATE sessions SET status = 'submitted', ended_at = now() WHERE id = ${sessionId}
  `;
  await sql`
    INSERT INTO events (actor_id, kind, payload)
    VALUES (${user.id}, 'session.submit', ${JSON.stringify({ sessionId })}::jsonb)
  `;
  return NextResponse.json({ ok: true, status: "submitted" });
}

/**
 * GET /api/sessions/[id]/state — load all node states for a session.
 * PATCH /api/sessions/[id]/state — partial update one node's data.
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
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const { id } = await ctx.params;
  const sessionId = parseInt(id, 10);
  const sql = neon(process.env.DATABASE_URL!);

  const owns = (await sql`
    SELECT id, status, course_id, assignment_id, started_at
    FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{
    id: number;
    status: string;
    course_id: number | null;
    assignment_id: number | null;
    started_at: string;
  }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const states = await sql`
    SELECT node_id, data, mentor_feedback, completed_at, updated_at
    FROM session_node_state WHERE session_id = ${sessionId}
  `;
  return NextResponse.json({ ok: true, session: owns[0], states });
}

export async function PATCH(
  req: Request,
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
  const body = (await req.json().catch(() => ({}))) as {
    nodeId?: string;
    data?: unknown;
    completed?: boolean;
  };
  if (!body.nodeId) {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sql`
    INSERT INTO session_node_state (session_id, node_id, data, completed_at, updated_at)
    VALUES (
      ${sessionId},
      ${body.nodeId},
      ${JSON.stringify(body.data ?? {})}::jsonb,
      ${body.completed ? new Date().toISOString() : null},
      now()
    )
    ON CONFLICT (session_id, node_id) DO UPDATE SET
      data = EXCLUDED.data,
      completed_at = COALESCE(EXCLUDED.completed_at, session_node_state.completed_at),
      updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}

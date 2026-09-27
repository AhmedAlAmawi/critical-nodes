/**
 * GET /api/sessions/[id]/receipt — the session receipt as JSON.
 *
 * Students can fetch their own sessions; faculty can fetch sessions in
 * courses they own.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireUser } from "@/lib/auth";
import { loadSessionReceipt } from "@/lib/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await requireUser();
  if (!user || user.id === -1) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sessionId = parseInt(id, 10);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const allowed = (await sql`
    SELECT s.id FROM sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${sessionId}
      AND (s.student_id = ${user.id} OR c.owner_id = ${user.id})
    LIMIT 1
  `) as Array<{ id: number }>;
  if (!allowed[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  const receipt = await loadSessionReceipt(sessionId);
  if (!receipt) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(JSON.stringify(receipt, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="critical-nodes-session-${sessionId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

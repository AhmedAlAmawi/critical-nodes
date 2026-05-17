import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { FinalAudit } from "@/components/studio/final-audit";

export const dynamic = "force-dynamic";

type Render = { id: number; prompt: string; blob_url: string };

type Ctx = { params: Promise<{ id: string }> };

export default async function AuditPage({ params }: Ctx) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  const user = await requireRole("student");
  const sql = neon(process.env.DATABASE_URL!);
  const sess = (await sql`
    SELECT id FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!sess[0]) notFound();

  const stateRows = (await sql`
    SELECT node_id, data FROM session_node_state WHERE session_id = ${sessionId}
  `) as unknown as Array<{ node_id: string; data: Record<string, unknown> }>;
  const states: Record<string, Record<string, unknown>> = {};
  for (const r of stateRows) states[r.node_id] = r.data ?? {};

  const renderRows = (await sql`
    SELECT id, prompt, blob_url FROM renders
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as Render[];

  return (
    <FinalAudit
      sessionId={sessionId}
      states={states}
      latestRender={renderRows[0] ?? null}
    />
  );
}

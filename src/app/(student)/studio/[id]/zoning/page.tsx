import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { PhaseRunner } from "@/components/phases/phase-runner";
import { zoningPhase } from "@/lib/phases/zoning";

export const dynamic = "force-dynamic";

export default async function ZoningPhasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  const user = await requireRole("student");
  const sql = neon(process.env.DATABASE_URL!);
  const sess = (await sql`
    SELECT id FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!sess[0]) notFound();
  return <PhaseRunner sessionId={sessionId} phase={zoningPhase} />;
}

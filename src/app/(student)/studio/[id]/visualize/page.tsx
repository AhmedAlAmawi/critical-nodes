/**
 * /studio/[id]/visualize — Stage B host.
 *
 * This page hosts the existing v2 LivingCanvas + FormDrawer + Nav UI
 * verbatim. The v2 reducer/state machine still drives the in-canvas
 * interaction; Phase 5 introduces a sidecar SessionSyncer that mirrors
 * the active node's data into session_node_state via the useSessionState
 * hook.
 *
 * The session id is read from the route param and forwarded to the
 * canvas via a small client wrapper that binds it into the sidecar.
 */

import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { VisualizeShell } from "@/components/studio/visualize-shell";

export const dynamic = "force-dynamic";

export default async function VisualizePage({
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
  return <VisualizeShell sessionId={sessionId} />;
}

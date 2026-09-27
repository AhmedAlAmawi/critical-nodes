/**
 * /studio/[id]/receipt — the student's end-of-session receipt: every response
 * collected across Concept, Zoning and the visualization nodes, printable,
 * downloadable as JSON, and submittable (locks the session).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { loadSessionReceipt } from "@/lib/receipt";
import { SessionReceipt } from "@/components/receipt/session-receipt";
import { ReceiptActions } from "@/components/receipt/receipt-actions";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  const user = await requireRole("student");
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id FROM sessions WHERE id = ${sessionId} AND student_id = ${user.id} LIMIT 1
  `) as Array<{ id: number }>;
  if (!owns[0]) notFound();

  const receipt = await loadSessionReceipt(sessionId);
  if (!receipt) notFound();

  const completed = new Set([
    ...receipt.phases.filter((p) => p.completedAt).map((p) => p.id as string),
    ...receipt.nodes.filter((n) => n.completedAt).map((n) => n.id),
  ]);
  const missingRequired = receipt.session.requiredNodes.filter((n) => !completed.has(n));

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <Link href={`/studio/${sessionId}`} className="text-xs text-stone-500 hover:text-stone-900">
            ← Session
          </Link>
          <h1 className="text-2xl font-serif mt-2">Receipt</h1>
          <p className="text-sm text-stone-500 mt-1">
            Everything you&rsquo;ve recorded in this session, in one place. Print it, download it, or submit it as your final record.
          </p>
        </div>
        <ReceiptActions
          sessionId={sessionId}
          status={receipt.session.status}
          canSubmit
          missingRequired={missingRequired}
        />
      </header>
      <SessionReceipt receipt={receipt} audience="student" />
    </main>
  );
}

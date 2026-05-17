/**
 * /faculty/courses/[id]/evaluations/[evalId] — review + override.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { EvaluationReview } from "@/components/faculty/evaluation-review";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  session_id: number;
  assignment_id: number;
  rubric_scores: Record<
    string,
    { score: number; evidence: string; citations?: number[] }
  >;
  narrative: string;
  citations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
  faculty_overrides: Record<string, number> | null;
  faculty_notes: string | null;
};

export default async function EvaluationDetail({
  params,
}: {
  params: Promise<{ id: string; evalId: string }>;
}) {
  const { id, evalId } = await params;
  const courseId = parseInt(id, 10);
  const evaluationId = parseInt(evalId, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT e.id, e.session_id, e.assignment_id, e.rubric_scores,
           e.narrative, e.citations, e.faculty_overrides, e.faculty_notes
    FROM evaluations e
    JOIN assignments a ON a.id = e.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE e.id = ${evaluationId} AND c.id = ${courseId} AND c.owner_id = ${user.id}
  `) as unknown as Row[];
  if (!rows[0]) notFound();
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/faculty/courses/${courseId}`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← Course
        </Link>
        <h1 className="text-3xl font-serif mt-2">Evaluation</h1>
        <p className="text-xs text-stone-500 mt-1">
          Session #{rows[0].session_id} · Assignment #{rows[0].assignment_id}
        </p>
      </header>
      <EvaluationReview evaluation={rows[0]} />
    </main>
  );
}

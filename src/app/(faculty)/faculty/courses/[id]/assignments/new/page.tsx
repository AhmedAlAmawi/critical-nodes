/**
 * /faculty/courses/[id]/assignments/new — assignment composer (single form).
 *
 * Per §10 of the spec, the production wizard has three steps; the MVP uses
 * one scrolling form with all three sections, which is identical in
 * function and easier to iterate on.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { AssignmentComposer } from "@/components/faculty/assignment-composer";

export const dynamic = "force-dynamic";

type Source = { id: number; title: string; kind: string; chunk_count: number };

export default async function NewAssignment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = parseInt(id, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const courseRow = (await sql`
    SELECT id, title FROM courses
    WHERE id = ${courseId} AND owner_id = ${user.id}
  `) as Array<{ id: number; title: string }>;
  if (!courseRow[0]) notFound();
  const sources = (await sql`
    SELECT id, title, kind,
      (SELECT COUNT(*) FROM source_chunks WHERE source_id = sources.id) AS chunk_count
    FROM sources WHERE course_id = ${courseId} AND ingest_status = 'done'
    ORDER BY created_at DESC
  `) as unknown as Source[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/faculty/courses/${courseId}/assignments`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← Assignments
        </Link>
        <h1 className="text-3xl font-serif mt-2">New assignment</h1>
        <p className="text-sm text-stone-600 mt-1">
          Pick a scope, pick the nodes students must complete, write the
          rubric. You can preview AI-generated questions before publishing.
        </p>
      </header>

      <AssignmentComposer
        courseId={courseId}
        sources={sources.map((s) => ({ ...s, chunk_count: Number(s.chunk_count) }))}
      />
    </main>
  );
}

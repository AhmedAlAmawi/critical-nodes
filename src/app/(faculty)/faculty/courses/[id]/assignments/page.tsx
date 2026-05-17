/**
 * /faculty/courses/[id]/assignments — list assignments + composer entry.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  brief: string | null;
  due_at: string | null;
  published_at: string | null;
  scope_source_ids: number[];
  required_nodes: string[];
};

export default async function AssignmentsList({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = parseInt(id, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id, title FROM courses
    WHERE id = ${courseId} AND owner_id = ${user.id}
  `) as Array<{ id: number; title: string }>;
  if (!owns[0]) notFound();
  const rows = (await sql`
    SELECT id, title, brief, due_at, published_at, scope_source_ids, required_nodes
    FROM assignments WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `) as unknown as Row[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <Link
            href={`/faculty/courses/${courseId}`}
            className="text-xs text-stone-500 hover:text-stone-900"
          >
            ← {owns[0].title}
          </Link>
          <h1 className="text-3xl font-serif mt-2">Assignments</h1>
        </div>
        <Link
          href={`/faculty/courses/${courseId}/assignments/new`}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          New assignment
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">
          No assignments yet. Use the composer to scope sources, pick nodes,
          and preview AI-generated questions before publishing.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{a.title}</div>
                {a.brief && (
                  <div className="text-xs text-stone-500 truncate">
                    {a.brief}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500">
                <span>{a.required_nodes?.length ?? 0} nodes</span>
                <span>{a.scope_source_ids?.length ?? 0} sources</span>
                <span
                  className={`rounded-full px-2 py-0.5 ${a.published_at ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-600"}`}
                >
                  {a.published_at ? "Published" : "Draft"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

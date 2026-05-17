/**
 * /faculty/courses/[id]/sources — material library + drop-zone.
 */

import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { SourceUploader } from "@/components/faculty/source-uploader";

export const dynamic = "force-dynamic";

type SourceRow = {
  id: number;
  title: string;
  kind: string;
  page_count: number | null;
  ingest_status: string;
  ingest_error: string | null;
  chunk_count: number;
  created_at: string;
};

export default async function SourcesPage({
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
    SELECT id, kind, title, page_count, ingest_status, ingest_error, created_at,
      (SELECT COUNT(*) FROM source_chunks WHERE source_id = sources.id) AS chunk_count
    FROM sources WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `) as unknown as SourceRow[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-8">
        <Link
          href={`/faculty/courses/${courseId}`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← {courseRow[0].title}
        </Link>
        <h1 className="text-3xl font-serif mt-2">Material library</h1>
        <p className="text-sm text-stone-600 mt-1">
          Drop PDFs, slide decks, images, or paste links. Every source is
          chunked + embedded so it can ground AI feedback and evaluation.
        </p>
      </header>

      <SourceUploader courseId={courseId} />

      <section className="mt-10">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
          Sources ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-stone-500">No sources yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {sources.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/faculty/courses/${courseId}/sources/${s.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-stone-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-stone-500 w-10">
                      {s.kind}
                    </span>
                    <span className="truncate">{s.title}</span>
                    {s.ingest_error && (
                      <span className="text-xs text-red-600 truncate">
                        {s.ingest_error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-500 tabular-nums">
                    {s.page_count && <span>{s.page_count} pages</span>}
                    <span>{Number(s.chunk_count)} chunks</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        s.ingest_status === "done"
                          ? "bg-green-50 text-green-700"
                          : s.ingest_status === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {s.ingest_status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

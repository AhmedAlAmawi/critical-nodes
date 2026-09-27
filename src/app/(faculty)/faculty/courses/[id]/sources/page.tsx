/**
 * /faculty/courses/[id]/sources — material library + drop-zone.
 */

import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { SourceUploader } from "@/components/faculty/source-uploader";
import { ResumeIngest } from "@/components/faculty/resume-ingest";

export const dynamic = "force-dynamic";

type SourceRow = {
  id: number;
  title: string;
  kind: string;
  page_count: number | null;
  ingest_status: string;
  ingest_error: string | null;
  chunk_count: number | string;
  vec_count: number | string;
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
    SELECT s.id, s.kind, s.title, s.page_count, s.ingest_status, s.ingest_error, s.created_at,
      (SELECT COUNT(*) FROM source_chunks c WHERE c.source_id = s.id) AS chunk_count,
      (SELECT COUNT(*) FROM source_chunks c
         JOIN source_chunk_vec v ON v.chunk_id = c.id
        WHERE c.source_id = s.id) AS vec_count
    FROM sources s WHERE s.course_id = ${courseId}
    ORDER BY s.created_at DESC
  `) as unknown as SourceRow[];

  const ready = sources.filter((s) => s.ingest_status === "done").length;

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
          Drop PDFs or images, or paste links. Every source is chunked and
          indexed so it can ground the AI mentor and evaluation for this course.
        </p>
      </header>

      <SourceUploader courseId={courseId} />

      <section className="mt-10">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
          Sources ({sources.length}
          {sources.length > 0 ? ` · ${ready} ready` : ""})
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-stone-500">No sources yet.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {sources.map((s) => {
              const chunks = Number(s.chunk_count);
              const vecs = Number(s.vec_count);
              const remaining = Math.max(0, chunks - vecs);
              const needsResume =
                remaining > 0 && (s.ingest_status === "running" || s.ingest_status === "error" || s.ingest_status === "queued");
              const stuckNoChunks =
                chunks === 0 && s.ingest_status !== "error" && (s.kind === "pdf" || s.kind === "link");
              return (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/faculty/courses/${courseId}/sources/${s.id}`}
                      className="flex items-center gap-3 min-w-0 hover:underline"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-stone-500 w-10 flex-shrink-0">
                        {s.kind}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </Link>
                    <div className="flex items-center gap-4 text-xs text-stone-500 tabular-nums flex-shrink-0">
                      {s.page_count ? <span>{s.page_count} pages</span> : null}
                      <span title="indexed chunks / total chunks">
                        {remaining > 0 ? `${vecs} / ${chunks} indexed` : `${chunks} chunks`}
                      </span>
                      {needsResume && <ResumeIngest sourceId={s.id} remaining={remaining} />}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          s.ingest_status === "done"
                            ? "bg-green-50 text-green-700"
                            : s.ingest_status === "error"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {s.ingest_status === "done" ? "ready" : s.ingest_status === "error" ? "error" : "indexing"}
                      </span>
                    </div>
                  </div>
                  {(s.ingest_error || stuckNoChunks) && (
                    <p className="mt-1 pl-[52px] text-xs text-red-600">
                      {s.ingest_error ??
                        "No text was extracted from this source. Re-upload it (older uploads predate the current pipeline)."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

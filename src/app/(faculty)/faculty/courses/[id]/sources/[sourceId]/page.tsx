/**
 * /faculty/courses/[id]/sources/[sourceId] — source viewer.
 *
 * Page-by-page layout: thumbnails on the left, chunks on the right. The MVP
 * inventory of chunks uses content_text excerpts; once raster URLs are
 * available (v3.0.1), image chunks will surface as thumbnails.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Source = {
  id: number;
  kind: string;
  title: string;
  blob_url: string;
  page_count: number | null;
  ingest_status: string;
};

type Chunk = {
  id: number;
  ordinal: number;
  kind: "text" | "image" | "table";
  page: number | null;
  content_text: string | null;
  image_blob_url: string | null;
  tokens: number | null;
};

export default async function SourceViewer({
  params,
}: {
  params: Promise<{ id: string; sourceId: string }>;
}) {
  const { id, sourceId } = await params;
  const courseId = parseInt(id, 10);
  const srcId = parseInt(sourceId, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT s.id, s.kind, s.title, s.blob_url, s.page_count, s.ingest_status
    FROM sources s JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${srcId} AND c.id = ${courseId} AND c.owner_id = ${user.id}
  `) as unknown as Source[];
  if (!owns[0]) notFound();
  const source = owns[0];
  const chunks = (await sql`
    SELECT id, ordinal, kind, page, content_text, image_blob_url, tokens
    FROM source_chunks WHERE source_id = ${srcId}
    ORDER BY ordinal LIMIT 500
  `) as unknown as Chunk[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/faculty/courses/${courseId}/sources`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← Material library
        </Link>
        <h1 className="text-2xl font-serif mt-2">{source.title}</h1>
        <p className="text-xs text-stone-500 mt-1">
          {source.kind.toUpperCase()} · {chunks.length} chunks
          {source.page_count ? ` · ${source.page_count} pages` : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-stone-500">
            Original
          </h2>
          <a
            href={source.blob_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs hover:border-stone-400"
          >
            Open original →
          </a>
        </aside>

        <section className="space-y-3">
          {chunks.length === 0 ? (
            <p className="text-sm text-stone-500">
              No chunks yet. {source.ingest_status === "running" ? "Still ingesting…" : ""}
            </p>
          ) : (
            <ul className="space-y-2">
              {chunks.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-stone-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
                    <span className="font-mono">#{c.id}</span>
                    <span className="uppercase tracking-widest">{c.kind}</span>
                    {c.page && <span>p.{c.page}</span>}
                    {c.tokens && <span>{c.tokens} tok</span>}
                  </div>
                  {c.image_blob_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.image_blob_url}
                      alt={`chunk ${c.id}`}
                      className="rounded-lg max-h-48 object-contain bg-stone-100"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-line">
                      {c.content_text?.slice(0, 800)}
                      {c.content_text && c.content_text.length > 800 && "…"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

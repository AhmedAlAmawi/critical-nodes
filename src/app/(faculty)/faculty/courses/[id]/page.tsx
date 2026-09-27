/**
 * /faculty/courses/[id] — course dashboard.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { CopyField } from "@/components/faculty/copy-field";

export const dynamic = "force-dynamic";

type Course = {
  id: number;
  title: string;
  code: string | null;
  slug: string;
  created_at: string;
};
type SourceRow = {
  id: number;
  title: string;
  kind: string;
  ingest_status: string;
  chunk_count: number;
  page_count: number | null;
};
type AssignmentRow = {
  id: number;
  title: string;
  due_at: string | null;
  published_at: string | null;
  scope_source_ids: number[];
  required_nodes: string[];
};

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = parseInt(id, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const courseRows = (await sql`
    SELECT id, title, code, slug, created_at FROM courses
    WHERE id = ${courseId} AND owner_id = ${user.id}
  `) as unknown as Course[];
  if (!courseRows[0]) notFound();
  const course = courseRows[0];

  const sources = (await sql`
    SELECT id, kind, title, page_count, ingest_status,
      (SELECT COUNT(*) FROM source_chunks WHERE source_id = sources.id) AS chunk_count
    FROM sources WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `) as unknown as SourceRow[];

  const assignments = (await sql`
    SELECT id, title, due_at, published_at, required_nodes, scope_source_ids
    FROM assignments WHERE course_id = ${courseId}
    ORDER BY created_at DESC
  `) as unknown as AssignmentRow[];

  const enrolledCount = (await sql`
    SELECT COUNT(*) AS c FROM enrollments WHERE course_id = ${courseId}
  `) as Array<{ c: number | string }>;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const joinLink = host ? `${proto}://${host}/studio?join=${encodeURIComponent(course.slug)}` : `/studio?join=${course.slug}`;

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <Link href="/faculty" className="text-xs text-stone-500 hover:text-stone-900">
          ← All courses
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-serif">{course.title}</h1>
          {course.code && (
            <span className="text-xs uppercase tracking-widest text-stone-500">
              {course.code}
            </span>
          )}
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Invite students</h2>
            <p className="text-xs text-stone-500 mt-1">
              Students enter this code (or open the link) from their Studio to join. {Number(enrolledCount[0]?.c ?? 0)} enrolled so far.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto">
            <CopyField label="Course code" value={course.slug} />
            <CopyField label="Join link" value={joinLink} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card
          title="Material library"
          subtitle={`${sources.length} source${sources.length === 1 ? "" : "s"}`}
          href={`/faculty/courses/${courseId}/sources`}
          cta="Manage sources →"
        />
        <Card
          title="Assignments"
          subtitle={`${assignments.length} total · ${assignments.filter((a) => a.published_at).length} published`}
          href={`/faculty/courses/${courseId}/assignments`}
          cta="Manage assignments →"
        />
        <Card
          title="Cohort progress"
          subtitle="Per-student × per-node status"
          href={`/faculty/courses/${courseId}/cohort`}
          cta="Open matrix →"
        />
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-serif mb-3">Recent sources</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-stone-500">
            No sources yet.{" "}
            <Link
              href={`/faculty/courses/${courseId}/sources`}
              className="underline"
            >
              Upload your first PDF or slide deck →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {sources.slice(0, 6).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] uppercase tracking-widest text-stone-500 w-10">
                    {s.kind}
                  </span>
                  <span className="truncate">{s.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-stone-500 tabular-nums">
                  {s.page_count && <span>{s.page_count} pages</span>}
                  <span>{Number(s.chunk_count)} chunks</span>
                  <StatusPill status={s.ingest_status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-serif mb-3">Recent assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-stone-500">
            No assignments yet.{" "}
            <Link
              href={`/faculty/courses/${courseId}/assignments/new`}
              className="underline"
            >
              Compose one →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {assignments.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="truncate">{a.title}</span>
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
      </section>
    </main>
  );
}

function Card({
  title,
  subtitle,
  href,
  cta,
}: {
  title: string;
  subtitle: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400 transition-colors"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-stone-500 mt-1">{subtitle}</div>
      <div className="mt-3 text-xs text-stone-700">{cta}</div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "bg-green-50 text-green-700"
      : status === "error"
        ? "bg-red-50 text-red-700"
        : status === "running"
          ? "bg-amber-50 text-amber-700"
          : "bg-stone-100 text-stone-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${tone}`}>{status}</span>;
}

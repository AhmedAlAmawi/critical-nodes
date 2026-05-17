/**
 * /faculty — course list.
 */

import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: number;
  title: string;
  code: string | null;
  slug: string;
  source_count: number;
  assignment_count: number;
  enrollment_count: number;
  created_at: string;
};

export default async function FacultyCoursesPage() {
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const courses = (await sql`
    SELECT c.id, c.title, c.code, c.slug, c.created_at,
      (SELECT COUNT(*) FROM sources WHERE course_id = c.id) AS source_count,
      (SELECT COUNT(*) FROM assignments WHERE course_id = c.id) AS assignment_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS enrollment_count
    FROM courses c WHERE c.owner_id = ${user.id}
    ORDER BY c.created_at DESC
  `) as unknown as CourseRow[];

  return (
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500">
            Faculty
          </p>
          <h1 className="text-3xl font-serif mt-1">Your courses</h1>
        </div>
        <Link
          href="/faculty/courses/new"
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          New course
        </Link>
      </header>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-500 text-sm">
          No courses yet. Create one to start uploading material and inviting students.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/faculty/courses/${c.id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-serif truncate">{c.title}</h2>
                  {c.code && (
                    <span className="text-[10px] uppercase tracking-widest text-stone-500">
                      {c.code}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-stone-500">
                  <Stat label="Sources" value={Number(c.source_count)} />
                  <Stat label="Assignments" value={Number(c.assignment_count)} />
                  <Stat label="Students" value={Number(c.enrollment_count)} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-stone-900 font-mono">{value}</div>
      <div className="uppercase tracking-widest text-[10px]">{label}</div>
    </div>
  );
}

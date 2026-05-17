/**
 * /faculty/courses/[id]/cohort — student × node progress matrix.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type EnrollmentRow = {
  student_id: number;
  display_name: string | null;
  email: string | null;
};

type SessionState = {
  session_id: number;
  student_id: number;
  assignment_id: number | null;
  assignment_title: string | null;
  status: string;
  node_id: string | null;
  completed_at: string | null;
};

type LatestSession = { student_id: number; session_id: number };

const NODES = [
  "concept",
  "zoning",
  "intent",
  "visualPriority",
  "references",
  "geometry",
  "materialsLight",
  "prompt",
  "audit",
  "finalAudit",
];

export default async function CohortPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = parseInt(id, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const owns = (await sql`
    SELECT id, title FROM courses WHERE id = ${courseId} AND owner_id = ${user.id}
  `) as Array<{ id: number; title: string }>;
  if (!owns[0]) notFound();

  const students = (await sql`
    SELECT e.student_id, u.display_name, u.email
    FROM enrollments e JOIN users u ON u.id = e.student_id
    WHERE e.course_id = ${courseId}
    ORDER BY u.display_name
  `) as unknown as EnrollmentRow[];

  const rows = (await sql`
    SELECT s.id AS session_id, s.student_id, s.assignment_id, a.title AS assignment_title,
           s.status, sns.node_id, sns.completed_at
    FROM sessions s
    LEFT JOIN assignments a ON a.id = s.assignment_id
    LEFT JOIN session_node_state sns ON sns.session_id = s.id
    WHERE s.course_id = ${courseId}
  `) as unknown as SessionState[];

  type Cell = "not-started" | "in-progress" | "completed";
  const matrix = new Map<string, Cell>();
  for (const r of rows) {
    if (!r.node_id) continue;
    const key = `${r.student_id}:${r.node_id}`;
    matrix.set(key, r.completed_at ? "completed" : "in-progress");
  }

  // Latest session per student for click-through.
  const latest = (await sql`
    SELECT DISTINCT ON (student_id) student_id, id AS session_id
    FROM sessions WHERE course_id = ${courseId}
    ORDER BY student_id, started_at DESC
  `) as unknown as LatestSession[];
  const sessionByStudent = new Map<number, number>(
    latest.map((l) => [Number(l.student_id), Number(l.session_id)]),
  );

  return (
    <main className="min-h-screen px-6 py-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/faculty/courses/${courseId}`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← {owns[0].title}
        </Link>
        <h1 className="text-3xl font-serif mt-2">Cohort progress</h1>
      </header>

      {students.length === 0 ? (
        <p className="text-sm text-stone-500">
          No students enrolled yet. Invite students via a course invite link.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-left text-stone-500">
                <th className="px-3 py-2 sticky left-0 bg-white">Student</th>
                {NODES.map((n) => (
                  <th key={n} className="px-2 py-2 font-normal">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const sid = sessionByStudent.get(Number(s.student_id));
                const href = sid
                  ? `/faculty/courses/${courseId}/sessions/${sid}`
                  : null;
                const Wrapper: React.FC<{ children: React.ReactNode }> = ({
                  children,
                }) =>
                  href ? (
                    <Link
                      href={href}
                      className="contents hover:bg-stone-50"
                      aria-label={`Open session ${sid}`}
                    >
                      {children}
                    </Link>
                  ) : (
                    <>{children}</>
                  );
                return (
                  <tr
                    key={s.student_id}
                    className="border-t border-stone-100 hover:bg-stone-50"
                  >
                    <Wrapper>
                      <td className="px-3 py-2 sticky left-0 bg-white truncate max-w-[200px]">
                        {s.display_name ?? s.email ?? `Student #${s.student_id}`}
                      </td>
                      {NODES.map((n) => {
                        const state =
                          matrix.get(`${s.student_id}:${n}`) ?? "not-started";
                        return (
                          <td key={n} className="px-2 py-2">
                            <span
                              className={`inline-block rounded-full w-3 h-3 ${
                                state === "completed"
                                  ? "bg-green-500"
                                  : state === "in-progress"
                                    ? "bg-amber-400"
                                    : "bg-stone-200"
                              }`}
                              title={state}
                            />
                          </td>
                        );
                      })}
                    </Wrapper>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

/**
 * /studio — student session list + start-new card.
 */

import Link from "next/link";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { NewSessionButton } from "@/components/studio/new-session-button";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  course_id: number | null;
  course_title: string | null;
  assignment_id: number | null;
  assignment_title: string | null;
};

type Available = {
  assignment_id: number;
  assignment_title: string;
  course_id: number;
  course_title: string;
  due_at: string | null;
};

export default async function StudioHome() {
  const user = await requireRole("student");
  const sql = neon(process.env.DATABASE_URL!);

  const sessions = (await sql`
    SELECT s.id, s.status, s.started_at, s.ended_at,
           s.course_id, c.title AS course_title,
           s.assignment_id, a.title AS assignment_title
    FROM sessions s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE s.student_id = ${user.id}
    ORDER BY s.started_at DESC
  `) as unknown as SessionRow[];

  const available = (await sql`
    SELECT a.id AS assignment_id, a.title AS assignment_title,
           c.id AS course_id, c.title AS course_title, a.due_at
    FROM assignments a
    JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ${user.id}
    JOIN courses c ON c.id = a.course_id
    WHERE a.published_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.assignment_id = a.id AND s.student_id = ${user.id}
      )
    ORDER BY a.due_at NULLS LAST
  `) as unknown as Available[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500">
            Studio
          </p>
          <h1 className="text-3xl font-serif mt-1">Your sessions</h1>
        </div>
        <NewSessionButton />
      </header>

      {available.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
            Pending assignments
          </h2>
          <ul className="space-y-2">
            {available.map((a) => (
              <li
                key={a.assignment_id}
                className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.assignment_title}</div>
                  <div className="text-xs text-stone-500 truncate">
                    {a.course_title}
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <form action={`/api/sessions`} method="POST">
                  {/* The button below is replaced by NewSessionButton-style client-side
                      POST in production; this is here as a server-rendered fallback link. */}
                  <Link
                    href={`/studio/new?assignmentId=${a.assignment_id}`}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
                  >
                    Start
                  </Link>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
          Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-stone-500">
            No sessions yet. Start a freeform session or pick an assignment above.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/studio/${s.id}`}
                  className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-400 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.assignment_title ?? s.course_title ?? "Freeform session"}
                      </div>
                      <div className="text-xs text-stone-500">
                        Started {new Date(s.started_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        s.status === "active"
                          ? "bg-amber-50 text-amber-700"
                          : s.status === "submitted"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-green-50 text-green-700"
                      }`}
                    >
                      {s.status}
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

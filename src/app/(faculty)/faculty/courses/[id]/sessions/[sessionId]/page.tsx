/**
 * /faculty/courses/[id]/sessions/[sessionId]
 *
 * Read-only faculty view of a student's session — every node's state, every
 * mentor message, every render. Linked from the cohort matrix.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";
import { TriggerEvaluation } from "@/components/faculty/trigger-evaluation";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: number;
  student_id: number;
  status: string;
  started_at: string;
  assignment_id: number | null;
  assignment_title: string | null;
  display_name: string | null;
};

type State = {
  node_id: string;
  data: Record<string, unknown>;
  completed_at: string | null;
};

type Mentor = {
  node_id: string;
  step: string | null;
  content: string;
  citations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
  created_at: string;
};

type Render = { id: number; prompt: string; blob_url: string; created_at: string };

type EvalRow = { id: number; created_at: string };

export default async function FacultySessionView({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const courseId = parseInt(id, 10);
  const sid = parseInt(sessionId, 10);
  const user = await requireRole("faculty");
  const sql = neon(process.env.DATABASE_URL!);
  const sessRows = (await sql`
    SELECT s.id, s.student_id, s.status, s.started_at, s.assignment_id,
           a.title AS assignment_title, u.display_name
    FROM sessions s
    JOIN users u ON u.id = s.student_id
    LEFT JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${sid} AND c.id = ${courseId} AND c.owner_id = ${user.id}
    LIMIT 1
  `) as unknown as SessionRow[];
  if (!sessRows[0]) notFound();
  const sess = sessRows[0];

  const states = (await sql`
    SELECT node_id, data, completed_at FROM session_node_state WHERE session_id = ${sid}
    ORDER BY node_id
  `) as unknown as State[];

  const mentor = (await sql`
    SELECT node_id, step, content, citations, created_at FROM mentor_messages
    WHERE session_id = ${sid}
    ORDER BY created_at DESC
    LIMIT 50
  `) as unknown as Mentor[];

  const renders = (await sql`
    SELECT id, prompt, blob_url, created_at FROM renders WHERE session_id = ${sid}
    ORDER BY created_at DESC
  `) as unknown as Render[];

  const evals = (await sql`
    SELECT id, created_at FROM evaluations WHERE session_id = ${sid}
    ORDER BY created_at DESC
  `) as unknown as EvalRow[];

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/faculty/courses/${courseId}/cohort`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← Cohort
        </Link>
        <h1 className="text-3xl font-serif mt-2">
          {sess.display_name ?? `Student #${sess.student_id}`}
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          {sess.assignment_title ?? "Freeform"} ·{" "}
          {new Date(sess.started_at).toLocaleString()} · {sess.status}
        </p>
      </header>

      {sess.assignment_id && (
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">AI evaluation</h2>
            <TriggerEvaluation
              sessionId={sid}
              assignmentId={sess.assignment_id}
              courseId={courseId}
            />
          </div>
          {evals.length === 0 ? (
            <p className="text-xs text-stone-500">No evaluation run yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {evals.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/faculty/courses/${courseId}/evaluations/${e.id}`}
                    className="text-stone-700 underline"
                  >
                    Evaluation #{e.id} —{" "}
                    {new Date(e.created_at).toLocaleString()}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
          Node states ({states.length})
        </h2>
        {states.length === 0 ? (
          <p className="text-sm text-stone-500">No work yet.</p>
        ) : (
          <ul className="space-y-2">
            {states.map((s) => (
              <li
                key={s.node_id}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.node_id}</span>
                  <span
                    className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 ${
                      s.completed_at
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {s.completed_at ? "Completed" : "In progress"}
                  </span>
                </div>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-stone-600 max-h-56 overflow-y-auto">
                  {JSON.stringify(s.data, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
          Mentor messages ({mentor.length})
        </h2>
        {mentor.length === 0 ? (
          <p className="text-sm text-stone-500">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {mentor.map((m, i) => (
              <li
                key={i}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>
                    {m.node_id}
                    {m.step ? ` · ${m.step}` : ""}
                  </span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm mt-2 italic">{m.content}</p>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.citations.map((c) => (
                      <span
                        key={c.chunkId}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px]"
                      >
                        #{c.chunkId}
                        {c.page ? ` p.${c.page}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {renders.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-widest text-stone-500 mb-3">
            Renders ({renders.length})
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {renders.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-stone-200 bg-white overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.blob_url}
                  alt={r.prompt}
                  className="w-full aspect-square object-cover bg-stone-100"
                />
                <p className="px-3 py-2 text-xs text-stone-600 line-clamp-2">
                  {r.prompt}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

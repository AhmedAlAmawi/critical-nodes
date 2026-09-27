/**
 * /studio/[id] — Living Canvas for a session. Shows all 10 nodes (2 pedagogy
 * + 7 visualization + final audit) and their status, with deep links into
 * each stage.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { neon } from "@neondatabase/serverless";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type StateRow = {
  node_id: string;
  data: unknown;
  mentor_feedback: unknown;
  completed_at: string | null;
};

const NODES: Array<{
  id: string;
  label: string;
  stage: "A" | "B" | "final";
  href: (sid: number) => string;
}> = [
  { id: "concept", label: "Concept", stage: "A", href: (s) => `/studio/${s}/concept` },
  { id: "zoning", label: "Zoning", stage: "A", href: (s) => `/studio/${s}/zoning` },
  { id: "intent", label: "Intent / Mentor", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "visualPriority", label: "Visual Priority", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "references", label: "References", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "geometry", label: "Geometry & View", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "materialsLight", label: "Material & Light", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "prompt", label: "Prompt", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "audit", label: "Per-node Audit", stage: "B", href: (s) => `/studio/${s}/visualize` },
  { id: "finalAudit", label: "Final Audit", stage: "final", href: (s) => `/studio/${s}/audit` },
];

export default async function SessionHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  const user = await requireRole("student");
  const sql = neon(process.env.DATABASE_URL!);
  const sessRows = (await sql`
    SELECT s.id, s.status, s.ended_at, s.assignment_id, a.title AS assignment_title,
           a.required_nodes
    FROM sessions s
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = ${sessionId} AND s.student_id = ${user.id}
  `) as Array<{
    id: number;
    status: string;
    ended_at: string | null;
    assignment_id: number | null;
    assignment_title: string | null;
    required_nodes: string[] | null;
  }>;
  if (!sessRows[0]) notFound();
  const sess = sessRows[0];

  const states = (await sql`
    SELECT node_id, data, mentor_feedback, completed_at
    FROM session_node_state WHERE session_id = ${sessionId}
  `) as unknown as StateRow[];
  const stateMap = new Map(states.map((s) => [s.node_id, s]));
  const requiredSet = new Set(sess.required_nodes ?? NODES.map((n) => n.id));
  const requiredDone = [...requiredSet].filter((n) => stateMap.get(n)?.completed_at).length;
  const submitted = sess.status !== "active";

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/studio" className="text-xs text-stone-500 hover:text-stone-900">
            ← All sessions
          </Link>
          <h1 className="text-3xl font-serif mt-2">
            {sess.assignment_title ?? "Freeform session"}
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            {requiredDone} / {requiredSet.size} required nodes complete
            {submitted && sess.ended_at ? ` · submitted ${new Date(sess.ended_at).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/studio/${sessionId}/receipt`}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              submitted || requiredDone === requiredSet.size
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "border border-stone-300 bg-white text-stone-800 hover:border-stone-900"
            }`}
          >
            {submitted ? "View receipt" : requiredDone === requiredSet.size ? "Review & submit →" : "Receipt so far"}
          </Link>
        </div>
      </header>
      {submitted && (
        <p className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          This session has been submitted. Your responses are locked as your final record — open the receipt to print or download them.
        </p>
      )}

      <div className="space-y-8">
        <Group title="Stage A — Pedagogy">
          {NODES.filter((n) => n.stage === "A").map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              sessionId={sessionId}
              state={stateMap.get(n.id)}
              required={requiredSet.has(n.id)}
            />
          ))}
        </Group>
        <Group title="Stage B — Visualization">
          {NODES.filter((n) => n.stage === "B").map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              sessionId={sessionId}
              state={stateMap.get(n.id)}
              required={requiredSet.has(n.id)}
            />
          ))}
        </Group>
        <Group title="Final">
          {NODES.filter((n) => n.stage === "final").map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              sessionId={sessionId}
              state={stateMap.get(n.id)}
              required={requiredSet.has(n.id)}
            />
          ))}
        </Group>
      </div>
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function NodeCard({
  node,
  sessionId,
  state,
  required,
}: {
  node: (typeof NODES)[number];
  sessionId: number;
  state: StateRow | undefined;
  required: boolean;
}) {
  const done = state?.completed_at != null;
  return (
    <li>
      <Link
        href={node.href(sessionId)}
        className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-400 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{node.label}</div>
            <div className="text-xs text-stone-500">
              {required ? "Required" : "Optional"}
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              done
                ? "bg-green-50 text-green-700"
                : state
                  ? "bg-amber-50 text-amber-700"
                  : "bg-stone-100 text-stone-600"
            }`}
          >
            {done ? "Complete" : state ? "In progress" : "Not started"}
          </span>
        </div>
      </Link>
    </li>
  );
}

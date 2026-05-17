"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ALL_NODES = [
  { id: "concept", label: "Concept (Stage A)" },
  { id: "zoning", label: "Zoning (Stage A)" },
  { id: "intent", label: "Intent / Design Mentor" },
  { id: "visualPriority", label: "Visual Priority" },
  { id: "references", label: "Reference Deconstruction" },
  { id: "geometry", label: "Geometry & View" },
  { id: "materialsLight", label: "Material & Light" },
  { id: "prompt", label: "Prompt Architecture" },
  { id: "audit", label: "Per-node Audit" },
  { id: "finalAudit", label: "Final cross-stage Audit" },
];

type Props = {
  courseId: number;
  sources: Array<{ id: number; title: string; kind: string; chunk_count: number }>;
};

export function AssignmentComposer({ courseId, sources }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [scopeSourceIds, setScopeSourceIds] = useState<Set<number>>(new Set());
  const [requiredNodes, setRequiredNodes] = useState<Set<string>>(
    new Set(ALL_NODES.map((n) => n.id)),
  );
  const [rubric, setRubric] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSource(id: number) {
    setScopeSourceIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleNode(id: string) {
    setRequiredNodes((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(publish: boolean) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          brief: brief || undefined,
          scopeSourceIds: Array.from(scopeSourceIds),
          requiredNodes: Array.from(requiredNodes),
          rubric: rubric ? { freeform: rubric } : {},
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          publish,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        assignmentId?: number;
        error?: string;
      };
      if (!res.ok || !j.assignmentId) {
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.push(`/faculty/courses/${courseId}/assignments`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-500">
          1. Brief
        </h2>
        <label className="block space-y-1.5">
          <span className="text-xs text-stone-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-stone-500">Brief</span>
          <textarea
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-stone-500">Due date</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-500">
          2. Scope — which sources are in play?
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-stone-500">
            No ingested sources yet. Upload material first.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sources.map((s) => {
              const on = scopeSourceIds.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggleSource(s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      on
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white hover:border-stone-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest opacity-70">
                        {s.kind}
                      </span>
                      <span className="truncate flex-1">{s.title}</span>
                      <span className="text-[10px] opacity-70 tabular-nums">
                        {s.chunk_count}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-500">
          3. Required nodes — which steps must students complete?
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_NODES.map((n) => {
            const on = requiredNodes.has(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => toggleNode(n.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  on
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </div>

        <label className="block space-y-1.5 mt-3">
          <span className="text-xs text-stone-500">Rubric (free-text)</span>
          <textarea
            rows={3}
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Score the work on clarity of concept, spatial logic, alignment of intent → prompt → render…"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={loading || !title.trim()}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:border-stone-500 disabled:opacity-40"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={loading || !title.trim()}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {loading ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}

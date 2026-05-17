"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TriggerEvaluation({
  sessionId,
  assignmentId,
  courseId,
}: {
  sessionId: number;
  assignmentId: number;
  courseId: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, assignmentId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        evaluationId?: number;
        error?: string;
      };
      if (!res.ok || !j.evaluationId) throw new Error(j.error ?? `HTTP ${res.status}`);
      router.push(`/faculty/courses/${courseId}/evaluations/${j.evaluationId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
      >
        {loading ? "Evaluating…" : "Run AI evaluation"}
      </button>
    </div>
  );
}

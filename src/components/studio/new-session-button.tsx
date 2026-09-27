"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function NewSessionButton({
  courseId,
  label = "New session",
  compact,
}: {
  courseId?: number;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const assignmentParam = params.get("assignmentId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignmentParam ? Number(assignmentParam) : null,
          courseId: courseId ?? null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { sessionId?: number; error?: string };
      if (!res.ok || !j.sessionId) throw new Error(j.error ?? `HTTP ${res.status}`);
      router.push(`/studio/${j.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={`rounded-lg bg-stone-900 font-medium text-white hover:bg-stone-800 disabled:opacity-40 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

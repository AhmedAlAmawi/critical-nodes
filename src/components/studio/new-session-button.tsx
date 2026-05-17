"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function NewSessionButton() {
  const router = useRouter();
  const params = useSearchParams();
  const assignmentParam = params.get("assignmentId");
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignmentParam ? Number(assignmentParam) : null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { sessionId?: number };
      if (j.sessionId) router.push(`/studio/${j.sessionId}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
    >
      {loading ? "Starting…" : "New session"}
    </button>
  );
}

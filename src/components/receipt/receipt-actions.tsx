"use client";

/**
 * Receipt toolbar — Print / Save as PDF, Download JSON, and (student only,
 * while active) Submit session, which locks the session and stamps ended_at.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReceiptActions({
  sessionId,
  status,
  canSubmit,
  missingRequired,
}: {
  sessionId: number;
  status: string;
  canSubmit: boolean;
  missingRequired: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/submit`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:border-stone-900"
      >
        Print / Save as PDF
      </button>
      <a
        href={`/api/sessions/${sessionId}/receipt`}
        download={`critical-nodes-session-${sessionId}.json`}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:border-stone-900"
      >
        Download JSON
      </a>
      {canSubmit && status === "active" && (
        <>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Submit session
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs">
              {missingRequired.length > 0 ? (
                <span className="text-amber-700">
                  {missingRequired.length} required node{missingRequired.length === 1 ? "" : "s"} not complete ({missingRequired.join(", ")}). Submit anyway?
                </span>
              ) : (
                <span>Submitting locks this session as your final record. Continue?</span>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Yes, submit"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-xs text-stone-500 underline">
                Cancel
              </button>
            </span>
          )}
        </>
      )}
      {status !== "active" && (
        <span className="text-xs text-green-700 px-2">Submitted — this receipt is your final record.</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

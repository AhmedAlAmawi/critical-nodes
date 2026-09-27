"use client";

/**
 * Resume button for a source whose embedding didn't finish (tab closed,
 * provider hiccup, old fire-and-forget deploy). Drives the same idempotent
 * `/api/ingest/[id]/embed` loop the uploader uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runEmbedLoop } from "@/lib/embed-loop";

export function ResumeIngest({
  sourceId,
  remaining,
}: {
  sourceId: number;
  remaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError(null);
    const result = await runEmbedLoop(sourceId, (p) => {
      setLabel(p.total ? `${p.embedded} / ${p.total}` : "…");
    });
    setBusy(false);
    if (result.status !== "done") setError(result.error ?? "Did not finish.");
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:border-stone-900 disabled:opacity-50"
        title={`${remaining} chunk${remaining === 1 ? "" : "s"} still need embedding`}
      >
        {busy ? `Indexing ${label ?? "…"}` : `Resume (${remaining} left)`}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}

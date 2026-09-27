/**
 * runEmbedLoop — browser-side driver for phase 2 of ingestion.
 *
 * Calls POST /api/ingest/[id]/embed repeatedly until the source reports
 * `remaining === 0` (done) or gives up after too many consecutive failures.
 * Progress is reported through the callback so the UI can show "k / n".
 */

"use client";

export type EmbedLoopProgress = {
  embedded: number;
  total: number;
  remaining: number;
  status: "running" | "done" | "error";
  error?: string;
};

export async function runEmbedLoop(
  sourceId: number,
  onProgress: (p: EmbedLoopProgress) => void,
  opts: { maxCalls?: number; maxConsecutiveFailures?: number } = {},
): Promise<EmbedLoopProgress> {
  const maxCalls = opts.maxCalls ?? 400; // 400 × 32 chunks = 12.8k chunks ≈ a 1,500-page PDF
  const maxFails = opts.maxConsecutiveFailures ?? 4;
  let fails = 0;
  let last: EmbedLoopProgress = { embedded: 0, total: 0, remaining: 1, status: "running" };

  for (let i = 0; i < maxCalls; i++) {
    try {
      const res = await fetch(`/api/ingest/${sourceId}/embed`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        embedded?: number;
        failed?: number;
        remaining?: number;
        total?: number;
        status?: "running" | "done" | "error";
        error?: string;
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);

      const total = j.total ?? 0;
      const remaining = j.remaining ?? 0;
      last = {
        embedded: total - remaining,
        total,
        remaining,
        status: j.status ?? (remaining === 0 ? "done" : "running"),
      };
      onProgress(last);
      if (last.status === "done" || remaining === 0) {
        return { ...last, status: "done" };
      }
      if ((j.embedded ?? 0) === 0 && (j.failed ?? 0) > 0) {
        fails++;
      } else {
        fails = 0;
      }
      if (fails >= maxFails) {
        return { ...last, status: "error", error: "Embedding provider kept failing — press Resume to retry later." };
      }
      // Small pause so the server-side rate limiter has room between calls.
      await new Promise((r) => setTimeout(r, fails ? 5000 : 500));
    } catch (err) {
      fails++;
      const msg = (err as Error).message;
      onProgress({ ...last, status: "running", error: msg });
      if (fails >= maxFails) {
        return { ...last, status: "error", error: msg };
      }
      await new Promise((r) => setTimeout(r, 3000 * fails));
    }
  }
  return { ...last, status: "error", error: "Stopped after too many calls — press Resume to continue." };
}

"use client";

import Link from "next/link";
import { useState } from "react";

type AuditPoint = {
  point: string;
  source: "intent" | "prompt" | "render";
  citations?: number[];
};

type AuditResult = {
  alignment: AuditPoint[];
  drift: AuditPoint[];
  contradiction: AuditPoint[];
  summary: string;
};

type Props = {
  sessionId: number;
  states: Record<string, Record<string, unknown>>;
  latestRender: { id: number; prompt: string; blob_url: string } | null;
};

export function FinalAudit({ sessionId, states, latestRender }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [fallback, setFallback] = useState(false);
  const [citationIds, setCitationIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const concept = states["concept"] as Record<string, unknown> | undefined;
  const conceptStatement =
    (concept?.aiConceptStatement as string | undefined) ??
    (concept?.thinkAnswers as Record<string, string> | undefined)?.[2] ??
    "";

  const zoning = states["zoning"] as Record<string, unknown> | undefined;
  const zoningText =
    (zoning?.actText as string | undefined) ??
    Object.values(
      (zoning?.thinkAnswers as Record<string, string> | undefined) ?? {},
    ).join(" / ");

  const promptState = states["prompt"];
  const promptSummary = promptState
    ? Object.entries(promptState)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        result?: AuditResult;
        fallback?: boolean;
        citations?: Array<{ chunkId: number }>;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setResult(j.result ?? null);
      setFallback(!!j.fallback);
      setCitationIds((j.citations ?? []).map((c) => c.chunkId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <Link
          href={`/studio/${sessionId}`}
          className="text-xs text-stone-500 hover:text-stone-900"
        >
          ← Session
        </Link>
        <h1 className="text-3xl font-serif mt-2">Final Alignment Audit</h1>
        <p className="text-sm text-stone-600 mt-1">
          Compare what you declared, what you constructed, and what was rendered.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Panel title="Declared intent" badge="Stage A">
          <p className="text-sm leading-relaxed">{conceptStatement || "(none)"}</p>
          {zoningText && (
            <>
              <hr className="my-3 border-stone-200" />
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                Zoning
              </p>
              <p className="text-sm leading-relaxed">{zoningText}</p>
            </>
          )}
        </Panel>
        <Panel title="Constructed prompt" badge="Stage B">
          {promptSummary ? (
            <pre className="text-sm whitespace-pre-wrap font-sans">{promptSummary}</pre>
          ) : latestRender ? (
            <p className="text-sm">{latestRender.prompt}</p>
          ) : (
            <p className="text-sm text-stone-500">(no prompt yet)</p>
          )}
        </Panel>
        <Panel title="Actual render" badge="Output">
          {latestRender ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={latestRender.blob_url}
              alt="latest render"
              className="rounded-lg max-h-72 object-contain bg-stone-100 w-full"
            />
          ) : (
            <p className="text-sm text-stone-500">No render produced yet.</p>
          )}
        </Panel>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {loading ? "Running audit…" : "Run final audit"}
        </button>
        {fallback && (
          <span className="text-xs text-amber-700">
            AI step fell back — using template summary.
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.summary && (
            <p className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-relaxed italic">
              {result.summary}
            </p>
          )}
          <Group
            title="Alignment"
            tone="green"
            items={result.alignment ?? []}
          />
          <Group title="Drift" tone="amber" items={result.drift ?? []} />
          <Group
            title="Contradiction"
            tone="red"
            items={result.contradiction ?? []}
          />
          {citationIds.length > 0 && (
            <div className="text-xs text-stone-500">
              Grounded against {citationIds.length} faculty chunk
              {citationIds.length === 1 ? "" : "s"}:
              <div className="mt-1 flex flex-wrap gap-1.5">
                {citationIds.map((id) => (
                  <span
                    key={id}
                    className="rounded-full bg-stone-100 px-2 py-0.5"
                  >
                    #{id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-[10px] uppercase tracking-widest text-stone-500">
          {badge}
        </span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Group({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "green" | "amber" | "red";
  items: AuditPoint[];
}) {
  const palette = {
    green: "border-green-200 bg-green-50/40",
    amber: "border-amber-200 bg-amber-50/40",
    red: "border-red-200 bg-red-50/40",
  }[tone];
  const dot = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[tone];
  return (
    <section className={`rounded-2xl border ${palette} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className="text-sm font-medium">
          {title} ({items.length})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-stone-500">None identified.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <span className="text-[10px] uppercase tracking-widest text-stone-500 mr-2">
                {it.source}
              </span>
              {it.point}
              {it.citations && it.citations.length > 0 && (
                <span className="ml-2 text-[10px] text-stone-500">
                  ({it.citations.map((c) => `#${c}`).join(", ")})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

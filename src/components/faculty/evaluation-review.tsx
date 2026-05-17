"use client";

import { useState } from "react";

type Row = {
  id: number;
  session_id: number;
  assignment_id: number;
  rubric_scores: Record<
    string,
    { score: number; evidence: string; citations?: number[] }
  >;
  narrative: string;
  citations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
  faculty_overrides: Record<string, number> | null;
  faculty_notes: string | null;
};

export function EvaluationReview({ evaluation }: { evaluation: Row }) {
  const [overrides, setOverrides] = useState<Record<string, number>>(
    evaluation.faculty_overrides ?? {},
  );
  const [notes, setNotes] = useState(evaluation.faculty_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/evaluations/${evaluation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facultyOverrides: overrides,
          facultyNotes: notes,
        }),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const criteria = Object.entries(evaluation.rubric_scores ?? {});

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-500">
          Rubric
        </h2>
        {criteria.length === 0 ? (
          <p className="text-sm text-stone-500">No rubric scores returned.</p>
        ) : (
          <ul className="space-y-3">
            {criteria.map(([key, val]) => (
              <li key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">AI: {val.score}/4</span>
                    <input
                      type="number"
                      min={0}
                      max={4}
                      step={1}
                      value={overrides[key] ?? val.score}
                      onChange={(e) =>
                        setOverrides({
                          ...overrides,
                          [key]: Number(e.target.value),
                        })
                      }
                      className="w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm text-right"
                    />
                  </div>
                </div>
                <p className="text-xs text-stone-600">{val.evidence}</p>
                {val.citations && val.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {val.citations.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px]"
                      >
                        #{c}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
          Narrative
        </h2>
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {evaluation.narrative}
        </p>
        {evaluation.citations && evaluation.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evaluation.citations.map((c) => (
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
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-stone-500">
          Faculty notes
        </h2>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your own notes — these are what the student will see along with your overridden scores."
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
        />
        <div className="flex items-center justify-end gap-2">
          {savedAt && (
            <span className="text-xs text-green-700">
              Saved {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save overrides"}
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

/**
 * The malzama-lineage phase runner — drives a Concept or Zoning phase end-to-end:
 *   Orient (3) → Sketch → Think (dynamic, with driver + compare + insights)
 *   → Act (missions or single output) → Reflect (recap → visual recall →
 *   choice → why → open Qs → AI mentor) → Synthesis (Concept only) → End
 *
 * Behaviour and copy follow malzama.vercel.app screen-for-screen (see
 * malzama-investigation.md §5). Differences from malzama are deliberate v3
 * upgrades only:
 *   - every answer is persisted server-side via useSessionState (functional
 *     updates, so rapid writes never clobber each other)
 *   - images upload to Vercel Blob (with inline fallback) instead of living
 *     as base64 in memory
 *   - the mission index is persisted so a refresh resumes where you were
 *   - mentor feedback is RAG-grounded through /api/mentor
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Phase, PhaseState, Mission } from "@/lib/phases/types";
import { emptyPhaseState } from "@/lib/phases/types";
import { referenceLabel } from "@/lib/phases/references";
import { useSessionState } from "@/lib/use-session-state";
import { spatialTranslationFor } from "@/lib/phases/spatial-translation-keywords";
import { uploadStudentImage } from "@/lib/upload-image";

type Props = { sessionId: number; phase: Phase };

type ThinkStep =
  | { kind: "question"; index: number }
  | { kind: "select"; index: number }
  | { kind: "driver" }
  | { kind: "compare" };

const REVEAL_MS = 1350;

/** Build the Think step list per malzama's function `b()`. */
export function buildThinkSteps(phase: Phase): ThinkStep[] {
  const opts = phase.questionOptions ?? [];
  const steps: ThinkStep[] = [];
  let driverInjected = false;
  let compareInjected = false;
  const anySelect = opts.some((o) => Array.isArray(o) && o.length > 0);

  for (let i = 0; i < phase.questions.length; i++) {
    const o = opts[i];
    const isSelect = Array.isArray(o) && o.length > 0;
    steps.push(isSelect ? { kind: "select", index: i } : { kind: "question", index: i });

    if (!driverInjected && phase.driverQuestion) {
      const nextIsSelect =
        i + 1 < opts.length && Array.isArray(opts[i + 1]) && (opts[i + 1] as string[]).length > 0;
      const inject = anySelect
        ? isSelect && !nextIsSelect
        : i === 1 && phase.questions.length > 2;
      if (inject) {
        steps.push({ kind: "driver" });
        driverInjected = true;
        if (!compareInjected && phase.reference && phase.compareQuestion) {
          steps.push({ kind: "compare" });
          compareInjected = true;
        }
      }
    }
  }
  return steps;
}

type Update = (patch: Partial<PhaseState>, completed?: boolean) => void;

export function PhaseRunner({ sessionId, phase }: Props) {
  const sst = useSessionState(sessionId);
  const raw = sst.getNode<Partial<PhaseState>>(phase.id);
  const data = useMemo<PhaseState>(
    () => ({ ...emptyPhaseState(), ...(raw ?? {}) }),
    [raw],
  );

  const update = useCallback<Update>(
    (patch, completed) => {
      sst.setNode<PhaseState>(
        phase.id,
        (prev) => ({ ...emptyPhaseState(), ...(prev ?? {}), ...patch }),
        { completed },
      );
    },
    [sst, phase.id],
  );

  const thinkSteps = useMemo(() => buildThinkSteps(phase), [phase]);

  if (sst.status === "loading") return <Centered>Loading…</Centered>;
  if (sst.status === "error") return <Centered>Failed to load: {sst.error}</Centered>;

  const stepperItems =
    phase.id === "concept"
      ? ["orient", "sketch", "think", "act", "reflect", "synthesis", "end"]
      : ["orient", "sketch", "think", "act", "reflect", "end"];

  return (
    <div className="min-h-screen bg-white">
      <Stepper items={stepperItems} active={data.step} sessionId={sessionId} />
      <main>
        {data.step === "orient" && (
          <OrientStep
            phase={phase}
            data={data}
            update={update}
            onDone={() => update({ step: "sketch", orientStep: 0 })}
          />
        )}
        {data.step === "sketch" && (
          <SketchStep
            phase={phase}
            sessionId={sessionId}
            data={data}
            update={update}
            onBack={() => update({ step: "orient", orientStep: 2 })}
            onContinue={() => update({ step: "think", thinkIndex: 0 })}
          />
        )}
        {data.step === "think" && (
          <ThinkStepView
            phase={phase}
            steps={thinkSteps}
            data={data}
            update={update}
            onBack={() => update({ step: "sketch" })}
            onDone={() => update({ step: "act", missionIndex: 0 })}
          />
        )}
        {data.step === "act" && (
          <ActStep
            phase={phase}
            sessionId={sessionId}
            data={data}
            update={update}
            onBack={() => update({ step: "think" })}
            onContinue={() => update({ step: "reflect", reflectIndex: 0 })}
          />
        )}
        {data.step === "reflect" && (
          <ReflectStep
            phase={phase}
            sessionId={sessionId}
            data={data}
            update={update}
            onBack={() => update({ step: "act" })}
            onDone={() =>
              update(
                { step: phase.id === "concept" ? "synthesis" : "end" },
                phase.id !== "concept",
              )
            }
          />
        )}
        {data.step === "synthesis" && phase.id === "concept" && (
          <SynthesisStep
            phase={phase}
            sessionId={sessionId}
            data={data}
            update={update}
            onBack={() => update({ step: "reflect" })}
            onDone={() => update({ step: "end" }, true)}
          />
        )}
        {data.step === "end" && (
          <EndStep phase={phase} sessionId={sessionId} data={data} />
        )}
      </main>
    </div>
  );
}

// --- Sticky pill stepper (malzama header) ------------------------------------

function Stepper({
  items,
  active,
  sessionId,
}: {
  items: string[];
  active: string;
  sessionId: number;
}) {
  const idx = items.indexOf(active);
  return (
    <div className="w-full border-b border-stone-100 sticky top-12 bg-white z-10 no-print">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
        <Link
          href={`/studio/${sessionId}`}
          className="text-xs text-stone-300 hover:text-stone-600 flex-shrink-0"
          title="Back to session"
        >
          ←
        </Link>
        <span className="text-xs text-stone-300 tabular-nums flex-shrink-0 hidden sm:block">
          Step {idx + 1} of {items.length}
        </span>
        <div className="flex items-center gap-0 flex-1">
          {items.map((it, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <div key={it} className="flex items-center flex-1 last:flex-none">
                <div
                  className={`flex items-center gap-1.5 py-0.5 px-2 rounded-full transition-all duration-300 ${current ? "bg-stone-100" : ""}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300 ${done ? "bg-stone-400" : current ? "bg-stone-900 scale-125" : "bg-stone-200"}`}
                  />
                  <span
                    className={`text-xs whitespace-nowrap capitalize transition-colors duration-300 ${done ? "text-stone-400" : current ? "text-stone-900 font-medium" : "text-stone-300"}`}
                  >
                    {it}
                    {done ? <span className="text-stone-400"> ✓</span> : null}
                  </span>
                </div>
                {i < items.length - 1 && (
                  <div
                    className="h-px flex-1 mx-1 transition-colors duration-300"
                    style={{ backgroundColor: done ? "#a8a29e" : "#e7e5e4" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-57px)] grid place-items-center text-sm text-stone-500">
      {children}
    </div>
  );
}

/** Standard malzama step frame: centred column, kicker row, thin progress bar. */
function Frame({
  kicker,
  right,
  pct,
  wide,
  onBack,
  children,
}: {
  kicker: string;
  right?: React.ReactNode;
  pct?: number;
  wide?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md mb-12">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                ← Back
              </button>
            )}
            <p className="text-xs font-medium tracking-widest text-stone-300 uppercase">
              {kicker}
            </p>
          </div>
          {right != null && <p className="text-xs text-stone-300">{right}</p>}
        </div>
        <div className="h-px bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-stone-400 transition-all duration-500 ease-out"
            style={{ width: `${pct ?? 100}%` }}
          />
        </div>
      </div>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} step-enter transition-all duration-300`}>
        {children}
      </div>
    </div>
  );
}

// --- Orient ------------------------------------------------------------------

function OrientStep({
  phase,
  data,
  update,
  onDone,
}: {
  phase: Phase;
  data: PhaseState;
  update: Update;
  onDone: () => void;
}) {
  const s = data.orientStep;
  const next = () => {
    if (s === 2) onDone();
    else update({ orientStep: (s + 1) as 1 | 2 });
  };
  const noun = phase.id === "concept" ? "a concept" : "zoning";
  return (
    <Frame kicker="Orient" right={phase.title} pct={[33, 66, 100][s]}>
      {s === 0 && (
        <div className="space-y-8">
          <div className="space-y-1">
            <Kicker>{phase.subtitle}</Kicker>
            <h1 className="text-3xl font-light text-stone-900 leading-snug">{phase.title}</h1>
          </div>
          <div className="space-y-3">
            <Kicker tone="mid">What is {noun}?</Kicker>
            <p className="text-lg font-light text-stone-700 leading-relaxed">
              {phase.conceptDefinition}
            </p>
          </div>
          <PrimaryButton onClick={next}>Show me an example →</PrimaryButton>
        </div>
      )}
      {s === 1 && (
        <div className="space-y-8">
          <div className="space-y-1">
            <Kicker>Strong example</Kicker>
            <p className="text-sm text-stone-400">Here is what a working {noun.replace(/^a /, "")} looks like:</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-6 border-l-4 border-stone-300">
            <p className="text-stone-800 text-base leading-relaxed">{phase.example}</p>
          </div>
          {phase.exampleExplanation && (
            <div className="space-y-1">
              <Kicker tone="mid">Why it works</Kicker>
              <p className="text-sm text-stone-500 leading-relaxed">{phase.exampleExplanation}</p>
            </div>
          )}
          <PrimaryButton onClick={next}>Makes sense →</PrimaryButton>
        </div>
      )}
      {s === 2 && (
        <div className="space-y-8">
          <Kicker>Academic reference</Kicker>
          <div className="border-l-2 border-stone-200 pl-6 space-y-3">
            <p className="text-xl font-light text-stone-700 leading-relaxed italic">
              “{phase.academic.insight}”
            </p>
            <p className="text-xs text-stone-400">— {phase.academic.source}</p>
          </div>
          <PrimaryButton onClick={next}>I&rsquo;m ready to think →</PrimaryButton>
        </div>
      )}
    </Frame>
  );
}

// --- Sketch ------------------------------------------------------------------

function SketchStep({
  phase,
  sessionId,
  data,
  update,
  onBack,
  onContinue,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function onFile(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
    setBusy(true);
    try {
      const res = await uploadStudentImage(file, { sessionId, key: `${phase.id}/sketch` });
      update({ userSketch: res.url });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Frame kicker="Sketch" right={phase.title} pct={100}>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-stone-900">Start with what you have.</h2>
          <p className="text-sm text-stone-400 leading-relaxed">
            Upload a sketch, photo, or rough diagram of your current idea. It
            doesn&rsquo;t need to be finished — it just needs to exist.
          </p>
        </div>

        {data.userSketch ? (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.userSketch} alt="Your sketch" className="w-full max-h-64 object-contain bg-stone-50" />
              <button
                type="button"
                onClick={() => update({ userSketch: null })}
                className="absolute top-3 right-3 bg-white border border-stone-200 text-stone-500 hover:text-stone-800 text-xs px-2.5 py-1 rounded-md transition-colors"
              >
                Remove
              </button>
            </div>
            <p className="text-xs text-stone-400">Looking good. You can add a note below.</p>
          </div>
        ) : (
          <DropZone onFile={onFile} busy={busy} big>
            <p className="text-sm text-stone-500">
              Drop your sketch here, or <span className="text-stone-700 underline underline-offset-2">browse files</span>
            </p>
            <p className="text-xs text-stone-300 mt-2">PNG, JPG, HEIC, PDF — any format</p>
          </DropZone>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-medium tracking-widest text-stone-400 uppercase">
            Optional note{" "}
            <span className="text-stone-300 font-normal normal-case tracking-normal ml-1">
              — what is this sketch about?
            </span>
          </label>
          <input
            type="text"
            value={data.userSketchNote}
            onChange={(e) => update({ userSketchNote: e.target.value })}
            placeholder="e.g. rough concept for the entrance sequence…"
            className={INPUT}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onBack} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
              ← Back
            </button>
            <PrimaryButton onClick={onContinue} disabled={!data.userSketch || busy}>
              Continue to Think →
            </PrimaryButton>
          </div>
          <button
            type="button"
            onClick={() => {
              update({ userSketch: null, userSketchNote: "" });
              onContinue();
            }}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </Frame>
  );
}

// --- Think ------------------------------------------------------------------

function ThinkStepView({
  phase,
  steps,
  data,
  update,
  onBack,
  onDone,
}: {
  phase: Phase;
  steps: ThinkStep[];
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onDone: () => void;
}) {
  const idx = Math.min(data.thinkIndex, steps.length - 1);
  const current = steps[idx];
  const [revealing, setRevealing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill the draft from a previously saved answer when (re)entering a step.
  useEffect(() => {
    if (current?.kind === "question") {
      setDraft(data.thinkAnswers[current.index] ?? "");
    } else {
      setDraft("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Defensive: if the step list is exhausted, move on (in an effect, not render).
  useEffect(() => {
    if (!current) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  if (!current) return null;

  const isLast = idx === steps.length - 1;
  const qSteps = steps.filter((s) => s.kind === "question" || s.kind === "select");
  const qNumber =
    current.kind === "question" || current.kind === "select"
      ? qSteps.findIndex((s) => (s as { index: number }).index === current.index) + 1
      : null;
  const pct = steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0;
  const compareIdx = steps.findIndex((s) => s.kind === "compare");
  const pastCompare = compareIdx !== -1 && idx > compareIdx;

  function advance(answer: string, response: string) {
    const key =
      current.kind === "driver" ? 99 : current.kind === "compare" ? 98 : current.index;
    update({ thinkAnswers: { ...data.thinkAnswers, [key]: answer } });
    setRevealing(response || "Good.");
    timer.current = setTimeout(() => {
      setRevealing(null);
      if (isLast) onDone();
      else update({ thinkIndex: idx + 1 });
    }, REVEAL_MS);
  }

  const insight =
    current.kind === "question" || current.kind === "select"
      ? phase.questionInsights?.[current.index] ?? null
      : null;
  const wide =
    (current.kind === "compare" && !revealing) ||
    (insight?.compare === true && data.userSketch != null && !revealing);

  return (
    <Frame
      kicker="Think"
      right={qNumber != null ? `${qNumber} / ${qSteps.length}` : undefined}
      pct={pct}
      wide={wide}
      onBack={() => (idx > 0 ? update({ thinkIndex: idx - 1 }) : onBack())}
    >
      {revealing ? (
        <Reveal message={revealing} />
      ) : current.kind === "question" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Kicker>Question {qNumber}</Kicker>
            <h3 className="text-2xl font-light text-stone-900 leading-snug">
              {phase.questions[current.index]}
            </h3>
          </div>
          {insight && (
            <InsightCard insight={insight} userSketch={pastCompare || insight.compare ? data.userSketch : null} userNote={data.userSketchNote} />
          )}
          <textarea
            value={draft}
            autoFocus
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) {
                advance(draft.trim(), phase.thinkResponses[current.index]);
              }
            }}
            placeholder="Your answer…"
            className={TEXTAREA}
          />
          <div className="flex items-center justify-between">
            <PrimaryButton
              onClick={() => advance(draft.trim(), phase.thinkResponses[current.index])}
              disabled={!draft.trim()}
            >
              Next →
            </PrimaryButton>
            <span className="text-xs text-stone-300">⌘ + Enter</span>
          </div>
        </div>
      ) : current.kind === "select" ? (
        <ChoiceGrid
          kicker={`Question ${qNumber}`}
          question={phase.questions[current.index]}
          options={phase.questionOptions[current.index] ?? []}
          insight={insight}
          userSketch={data.userSketch}
          cols={2}
          onSelect={(o) => advance(o, phase.thinkResponses[current.index])}
        />
      ) : current.kind === "driver" ? (
        <ChoiceGrid
          kicker="Your lens"
          question={phase.driverQuestion}
          options={phase.driverOptions}
          cols={2}
          onSelect={(o) => advance(o, phase.driverResponse)}
        />
      ) : (
        <div className="space-y-6">
          <Kicker>Compare</Kicker>
          <div className="border-l-2 border-stone-200 pl-5">
            <p className="text-base italic text-stone-600 leading-relaxed">“{phase.academic.insight}”</p>
            <p className="text-xs text-stone-400 mt-1">— {phase.reference.source}</p>
          </div>
          <div className={`grid ${data.userSketch ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
            <Figure src={phase.reference.image} caption={phase.reference.caption} />
            {data.userSketch && (
              <Figure src={data.userSketch} caption={data.userSketchNote?.trim() || "Your sketch"} />
            )}
          </div>
          <h3 className="text-xl font-light text-stone-900 leading-snug">{phase.compareQuestion}</h3>
          <div className="flex flex-col gap-3">
            {phase.compareOptions.map((o) => (
              <ChoiceButton key={o} onClick={() => advance(o, phase.compareResponse)}>
                {o}
              </ChoiceButton>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}

function ChoiceGrid({
  kicker,
  question,
  options,
  insight,
  userSketch,
  cols,
  onSelect,
}: {
  kicker: string;
  question: string;
  options: string[];
  insight?: Phase["questionInsights"][number] | null;
  userSketch?: string | null;
  cols: 2 | 3;
  onSelect: (o: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Kicker>{kicker}</Kicker>
        <h3 className="text-2xl font-light text-stone-900 leading-snug">{question}</h3>
      </div>
      {insight && <InsightCard insight={insight} userSketch={insight.compare ? userSketch ?? null : null} />}
      <div className={`grid ${cols === 3 ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
        {options.map((o) => (
          <ChoiceButton
            key={o}
            selected={picked === o}
            dim={picked != null && picked !== o}
            onClick={() => {
              if (picked) return;
              setPicked(o);
              setTimeout(() => onSelect(o), 350);
            }}
          >
            {o}
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  userSketch,
  userNote,
}: {
  insight: NonNullable<Phase["questionInsights"][number]>;
  userSketch: string | null;
  userNote?: string;
}) {
  return (
    <div className="space-y-4">
      {insight.compare && userSketch ? (
        <div>
          <p className="text-xs text-stone-300 uppercase tracking-widest mb-3">Reference vs. Your Sketch</p>
          <div className="grid grid-cols-2 gap-3">
            <Figure src={insight.visual} caption={insight.caption} />
            <Figure src={userSketch} caption={userNote?.trim() || "Your work"} />
          </div>
        </div>
      ) : (
        <Figure src={insight.visual} caption={insight.caption} tall />
      )}
      <div className="flex gap-3">
        <div className="mt-0.5 w-px bg-stone-300 flex-shrink-0" />
        <div>
          <p className="text-sm italic text-stone-500 leading-relaxed">“{insight.text}”</p>
          <p className="mt-1.5 text-xs text-stone-300 tracking-wide">— {referenceLabel(insight.referenceId)}</p>
        </div>
      </div>
      <div className="h-px bg-stone-100" />
    </div>
  );
}

function Figure({ src, caption, tall }: { src: string; caption: string; tall?: boolean }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <figure
        className="relative group rounded-xl overflow-hidden border border-stone-100 bg-stone-50 cursor-zoom-in"
        onClick={() => setZoom(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption}
          className={`w-full object-contain ${tall ? "min-h-[220px] max-h-80" : "min-h-[180px] max-h-56"}`}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-end p-2">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-500 text-xs px-2 py-1 rounded-md">
            ⊞
          </span>
        </div>
        <figcaption className="px-3 py-2 border-t border-stone-100 text-xs text-stone-400 leading-snug">
          {caption}
        </figcaption>
      </figure>
      {zoom && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={caption} className="max-h-full max-w-full rounded-lg bg-white" />
        </div>
      )}
    </>
  );
}

// --- Act --------------------------------------------------------------------

function ActStep(props: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onContinue: () => void;
}) {
  if (props.phase.missions && props.phase.missions.length > 0) {
    return <ActMissions {...props} />;
  }
  return <ActSingle {...props} />;
}

function ActSingle({
  phase,
  sessionId,
  data,
  update,
  onBack,
  onContinue,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [ready, setReady] = useState(!!data.actText);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  // 2-minute optional focus timer (malzama).
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [secs, setSecs] = useState(120);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 900);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  async function onImage(file: File) {
    setBusy(true);
    try {
      const res = await uploadStudentImage(file, { sessionId, key: `${phase.id}/act` });
      update({ actImageUrl: res.url });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-[calc(100vh-57px)] flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center space-y-10 step-enter">
          <div className="space-y-5">
            <h2 className="text-5xl font-light text-stone-900 tracking-tight">Now stop.</h2>
            <p
              className="text-base text-stone-400 font-light leading-relaxed transition-all duration-700"
              style={{ opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(6px)" }}
            >
              Close everything else.
              <br />
              This is the only thing right now.
            </p>
          </div>
          <div
            className="transition-all duration-500 flex items-center gap-4 justify-center"
            style={{ opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(8px)" }}
          >
            <button type="button" onClick={onBack} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
              ← Back
            </button>
            <PrimaryButton onClick={() => setReady(true)}>I&rsquo;m ready →</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const timeUp = started && secs === 0;
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md step-enter space-y-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <button type="button" onClick={() => setReady(false)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              ← Back
            </button>
            <Kicker>Act</Kicker>
          </div>
          <h3 className="text-2xl font-light text-stone-900 leading-snug">{phase.action.instruction}</h3>
          <p className="text-sm text-stone-500">{phase.action.description}</p>
        </div>

        <div className="bg-stone-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-light tabular-nums transition-colors ${timeUp ? "text-stone-400" : running ? "text-stone-900" : "text-stone-400"}`}>
                {mm}:{ss}
              </span>
              {timeUp && <span className="text-xs text-stone-400 fade-in">Time&rsquo;s up</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStarted(true);
                  setRunning((r) => !r);
                }}
                className="text-xs text-stone-600 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-stone-100 transition-colors"
              >
                {running ? "Pause" : started ? "Resume" : "Start timer"}
              </button>
              {started && (
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setStarted(false);
                    setSecs(120);
                  }}
                  className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          {started && (
            <div className="h-px bg-stone-200 rounded-full overflow-hidden fade-in">
              <div className="h-full bg-stone-400 transition-all duration-1000 ease-linear" style={{ width: `${((120 - secs) / 120) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium tracking-widest text-stone-400 uppercase">
            Your output <span className="text-red-400 ml-0.5">*</span>
          </label>
          <textarea
            value={data.actText}
            onChange={(e) => update({ actText: e.target.value })}
            rows={6}
            autoFocus
            placeholder={phase.action.placeholder}
            className={TEXTAREA}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium tracking-widest text-stone-400 uppercase">
            Attach image <span className="text-stone-300 font-normal normal-case tracking-normal ml-1">(optional)</span>
          </label>
          {data.actImageUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.actImageUrl} alt="Uploaded design" className="w-full max-h-56 object-contain bg-stone-50" />
              <button
                type="button"
                onClick={() => update({ actImageUrl: null })}
                className="absolute top-3 right-3 bg-white border border-stone-200 text-stone-500 hover:text-stone-800 text-xs px-2.5 py-1 rounded-md transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <DropZone onFile={onImage} busy={busy}>
              <p className="text-sm text-stone-400">
                Drop a sketch here, or <span className="text-stone-600 underline underline-offset-2">click to upload</span>
              </p>
            </DropZone>
          )}
        </div>

        <PrimaryButton onClick={onContinue} disabled={!data.actText.trim() || busy}>
          Continue to Reflect →
        </PrimaryButton>
      </div>
    </div>
  );
}

function ActMissions({
  phase,
  sessionId,
  data,
  update,
  onBack,
  onContinue,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onContinue: () => void;
}) {
  const missions: Mission[] = phase.missions ?? [];
  const idx = Math.min(data.missionIndex ?? 0, missions.length - 1);
  const current = missions[idx];
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!current) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  if (!current) return null;

  const output = data.diagramOutputs[current.outputKey] ?? { text: "", image: null };
  const isLast = idx === missions.length - 1;
  const reqMet = !current.required || !!output.image;

  function setOutput(patch: Partial<typeof output>) {
    update({
      diagramOutputs: {
        ...data.diagramOutputs,
        [current.outputKey]: { ...output, ...patch },
      },
    });
  }
  async function onFile(file: File) {
    setBusy(true);
    try {
      const res = await uploadStudentImage(file, {
        sessionId,
        key: `${phase.id}/missions/${current.id}`,
      });
      setOutput({ image: res.url });
    } finally {
      setBusy(false);
    }
  }
  function goNext() {
    if (isLast) onContinue();
    else update({ missionIndex: idx + 1 });
  }

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-2xl mx-auto">
          {idx === 0 && phase.missionsIntro && (
            <div className="mb-8 bg-stone-50 border border-stone-100 rounded-lg px-5 py-4">
              <p className="text-sm text-stone-500 leading-relaxed">{phase.missionsIntro}</p>
            </div>
          )}
          <div className="flex items-center gap-3 mb-6">
            <Kicker>
              Mission {idx + 1} of {missions.length}
            </Kicker>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${current.required ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`}
            >
              {current.required ? "Required" : "Optional"}
            </span>
          </div>
          <h2 className="text-3xl font-light text-stone-900 mb-8">{current.title}</h2>

          <div className="mb-8 space-y-4">
            <Figure src={current.visual} caption={current.caption} tall />
            <div className="flex gap-3">
              <div className="mt-0.5 w-px bg-stone-300 flex-shrink-0" />
              <div>
                <p className="text-sm italic text-stone-500 leading-relaxed">“{current.insight}”</p>
                <p className="mt-1.5 text-xs text-stone-300 tracking-wide">— {referenceLabel(current.referenceId)}</p>
              </div>
            </div>
            <div className="h-px bg-stone-100" />
          </div>

          <div className="mb-8">
            <Kicker>Your task</Kicker>
            <p className="text-lg font-light text-stone-800 leading-relaxed mt-3">{current.task}</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium tracking-widest text-stone-400 uppercase">
                Your diagram {current.required && <span className="text-red-400">*</span>}
              </label>
              {output.image ? (
                <div className="relative rounded-lg overflow-hidden border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={output.image} alt={current.title} className="w-full max-h-72 object-contain bg-stone-50" />
                  <button
                    type="button"
                    onClick={() => setOutput({ image: null })}
                    className="absolute top-3 right-3 bg-white border border-stone-200 text-stone-500 hover:text-stone-800 text-xs px-2.5 py-1 rounded-md transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <DropZone onFile={onFile} busy={busy} big>
                  <p className="text-sm text-stone-500">
                    Drop your diagram here, or <span className="text-stone-700 underline underline-offset-2">browse files</span>
                  </p>
                  <p className="text-xs text-stone-300 mt-2">Photo, sketch, or scanned diagram</p>
                </DropZone>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium tracking-widest text-stone-400 uppercase">
                Notes <span className="text-stone-300 font-normal normal-case tracking-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={output.text}
                onChange={(e) => setOutput({ text: e.target.value })}
                rows={3}
                placeholder={current.placeholder}
                className={TEXTAREA}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-stone-100 px-6 py-4 no-print">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => (idx === 0 ? onBack() : update({ missionIndex: idx - 1 }))}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors px-3 py-2 -ml-3 rounded-md hover:bg-stone-50"
          >
            ← Back
          </button>
          <span className="text-xs text-stone-300 tabular-nums">
            {idx + 1} / {missions.length}
          </span>
          <div className="flex items-center gap-3">
            {!current.required && !isLast && (
              <button type="button" onClick={goNext} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
                Skip →
              </button>
            )}
            <PrimaryButton onClick={goNext} disabled={!reqMet || busy} compact>
              {isLast ? "Continue to Reflect →" : "Next mission →"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Reflect ----------------------------------------------------------------

type ReflectStage = "recap" | "recall" | "choice" | "why" | "open" | "mentor";

function ReflectStep({
  phase,
  sessionId,
  data,
  update,
  onBack,
  onDone,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onDone: () => void;
}) {
  // All hooks first — this component has many early returns below.
  const [stage, setStage] = useState<ReflectStage>(
    data.aiFeedback !== null ? "mentor" : "recap",
  );
  const [revealing, setRevealing] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [loadingMentor, setLoadingMentor] = useState(false);
  const fired = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reflectQuestions = phase.reflection;
  const remaining = reflectQuestions.slice(1);
  const openIdx = Math.min(data.reflectIndex, remaining.length);

  // Prefill drafts when moving between sub-stages.
  useEffect(() => {
    if (stage === "recall") setDraft(data.reflectAnswers[97] ?? "");
    else if (stage === "why") {
      const saved = data.reflectAnswers[0] ?? "";
      setDraft(saved.includes(" — ") ? saved.split(" — ").slice(1).join(" — ") : "");
    } else if (stage === "open") setDraft(data.reflectAnswers[openIdx + 1] ?? "");
    else setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, openIdx]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Open-question list exhausted → mentor.
  useEffect(() => {
    if (stage === "open" && openIdx >= remaining.length) setStage("mentor");
  }, [stage, openIdx, remaining.length]);

  // Fire the grounded mentor call exactly once when entering `mentor`.
  useEffect(() => {
    if (stage !== "mentor") return;
    if (data.aiFeedback !== null) return;
    if (fired.current) return;
    fired.current = true;
    setLoadingMentor(true);
    const think = Object.entries(data.thinkAnswers)
      .filter(([k]) => Number(k) < 90)
      .map(([, v]) => v)
      .join(" | ");
    const act =
      data.actText ||
      Object.values(data.diagramOutputs)
        .map((o) => o.text)
        .filter(Boolean)
        .join(" | ") ||
      "(diagram uploads)";
    const reflect = Object.values(data.reflectAnswers).join(" | ");
    const promptText = [
      `Phase: ${phase.title}`,
      `Student's thinking: ${think}`,
      `Student's output: ${act}`,
      `Student's reflection: ${reflect}`,
      "",
      "Give exactly 1–2 sentences of honest, direct feedback. Be specific. No praise padding. No long explanations.",
    ].join("\n");
    fetch("/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        nodeId: phase.id,
        step: "reflect-end",
        prompt: promptText,
        query: `${act}\n\n${think}`.slice(0, 2000),
        temperature: 0.7,
      }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          feedback?: string;
          citations?: Array<{ chunkId: number; sourceId: number; page: number | null }>;
        };
        update({ aiFeedback: j.feedback ?? "", aiFeedbackCitations: j.citations ?? [] });
      })
      .catch(() => update({ aiFeedback: "" }))
      .finally(() => setLoadingMentor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function revealThen(msg: string, then: () => void) {
    setRevealing(msg);
    timer.current = setTimeout(() => {
      setRevealing(null);
      then();
    }, REVEAL_MS);
  }

  const nonRecap: ReflectStage[] = ["recall", "choice", "why", "open", "mentor"];
  const stageOrder: ReflectStage[] = data.userSketch
    ? ["recap", ...nonRecap]
    : ["recap", "choice", "why", "open", "mentor"];
  const pos = stageOrder.indexOf(stage);
  const pct = stageOrder.length > 1 ? (pos / (stageOrder.length - 1)) * 100 : 0;
  const counter =
    stage === "open" ? `${openIdx + 2} / ${reflectQuestions.length}` : stage === "recall" ? "Visual recall" : undefined;

  const back = () => {
    if (revealing) return;
    if (stage === "recap") onBack();
    else if (stage === "recall") setStage("recap");
    else if (stage === "choice") setStage(data.userSketch ? "recall" : "recap");
    else if (stage === "why") setStage("choice");
    else if (stage === "open") {
      if (openIdx > 0) update({ reflectIndex: openIdx - 1 });
      else setStage("why");
    } else if (stage === "mentor") {
      update({ reflectIndex: Math.max(0, remaining.length - 1) });
      setStage("open");
    }
  };

  const outputPreview = (
    <>
      {data.actImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.actImageUrl} alt="Your design output" className="w-full max-h-56 object-contain bg-stone-50 rounded-lg border border-stone-200" />
      )}
      {!data.actImageUrl && Object.values(data.diagramOutputs).some((o) => o.image) && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(data.diagramOutputs)
            .filter(([, o]) => o.image)
            .map(([k, o]) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={o.image!} alt={k} className="w-full aspect-square object-contain bg-stone-50 rounded-lg border border-stone-200" />
            ))}
        </div>
      )}
      {data.actText && <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">{data.actText}</p>}
    </>
  );

  if (stage === "recap") {
    return (
      <Frame kicker="Reflect" pct={0} onBack={back}>
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-light text-stone-900">Look at what you made.</h3>
          </div>
          <div className="space-y-2">
            <Kicker tone="mid">Your output</Kicker>
            {outputPreview}
          </div>
          <p className="text-sm text-stone-400 leading-relaxed">Don&rsquo;t evaluate it yet. Just notice it.</p>
          <PrimaryButton onClick={() => setStage(data.userSketch ? "recall" : "choice")}>Begin reflecting →</PrimaryButton>
        </div>
      </Frame>
    );
  }

  return (
    <Frame kicker="Reflect" right={counter} pct={pct} onBack={back}>
      {revealing ? (
        <Reveal message={revealing} />
      ) : loadingMentor || (stage === "mentor" && data.aiFeedback === null) ? (
        <div className="text-center py-6 space-y-3 fade-in">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin" />
            <p className="text-sm text-stone-400">Getting mentor feedback…</p>
          </div>
        </div>
      ) : stage === "recall" ? (
        <div className="space-y-8">
          <div className="space-y-2">
            <Kicker>Visual recall</Kicker>
            <h3 className="text-xl font-light text-stone-900 leading-snug">Compare your initial sketch to what you produced.</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs text-stone-400">Initial sketch</p>
              <Square src={data.userSketch} empty="No sketch" />
              {data.userSketchNote && <p className="text-xs text-stone-400 line-clamp-1">{data.userSketchNote}</p>}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-stone-400">What you produced</p>
              <Square src={data.actImageUrl ?? firstDiagram(data)} empty={data.actText || "No image"} />
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-base font-light text-stone-900">Looking at your work now, what would you change?</p>
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  update({ reflectAnswers: { ...data.reflectAnswers, 97: draft.trim() } });
                  setStage("choice");
                }
              }}
              placeholder="One thing — be specific."
              className={INPUT}
            />
            <div className="flex items-center justify-between">
              <PrimaryButton
                onClick={() => {
                  update({ reflectAnswers: { ...data.reflectAnswers, 97: draft.trim() } });
                  setStage("choice");
                }}
                disabled={!draft.trim()}
              >
                Next →
              </PrimaryButton>
              <span className="text-xs text-stone-300">Enter</span>
            </div>
          </div>
        </div>
      ) : stage === "choice" ? (
        <ChoiceGrid
          kicker="Question 1"
          question={reflectQuestions[0]}
          options={phase.reflectChoices}
          cols={3}
          onSelect={(c) => {
            setChoice(c);
            setStage("why");
          }}
        />
      ) : stage === "why" ? (
        <div className="space-y-8">
          <div className="space-y-2">
            {(choice || data.reflectAnswers[0]) && (
              <p className="text-xs text-stone-300">You said: {choice || (data.reflectAnswers[0] ?? "").split(" — ")[0]}</p>
            )}
            <h3 className="text-2xl font-light text-stone-900">Why?</h3>
          </div>
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) submitWhy();
            }}
            placeholder="Be specific…"
            className={TEXTAREA}
          />
          <div className="flex items-center justify-between">
            <PrimaryButton onClick={submitWhy} disabled={!draft.trim()}>
              Next →
            </PrimaryButton>
            <span className="text-xs text-stone-300">⌘ + Enter</span>
          </div>
        </div>
      ) : stage === "open" && remaining[openIdx] ? (
        <div className="space-y-8">
          <h3 className="text-2xl font-light text-stone-900 leading-snug">{remaining[openIdx]}</h3>
          <textarea
            autoFocus
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) submitOpen();
            }}
            placeholder="Your reflection…"
            className={TEXTAREA}
          />
          <div className="flex items-center justify-between">
            <PrimaryButton onClick={submitOpen} disabled={!draft.trim()}>
              {openIdx === remaining.length - 1 ? "Complete Phase →" : "Next →"}
            </PrimaryButton>
            <span className="text-xs text-stone-300">⌘ + Enter</span>
          </div>
        </div>
      ) : stage === "mentor" ? (
        <div className="space-y-8">
          <div className="space-y-2">
            <Kicker>Mentor feedback</Kicker>
            <h3 className="text-2xl font-light text-stone-900">A note from the studio.</h3>
          </div>
          <div className="border border-stone-200 rounded-lg p-6 space-y-3 step-enter-slow">
            {data.aiFeedback ? (
              <p className="text-stone-700 text-base leading-relaxed italic font-light">“{data.aiFeedback}”</p>
            ) : (
              <p className="text-sm text-stone-400">Mentor feedback is unavailable right now — your reflection has been saved.</p>
            )}
            {data.aiFeedbackCitations.length > 0 && (
              <p className="text-xs text-stone-400">
                Grounded in your faculty&rsquo;s material ({data.aiFeedbackCitations.length} citation
                {data.aiFeedbackCitations.length === 1 ? "" : "s"}).
              </p>
            )}
          </div>
          <PrimaryButton onClick={onDone}>
            {phase.id === "concept" ? "Continue to Synthesis →" : "Finish phase →"}
          </PrimaryButton>
        </div>
      ) : null}
    </Frame>
  );

  function submitWhy() {
    const c = choice || (data.reflectAnswers[0] ?? "").split(" — ")[0];
    const stitched = c ? `${c} — ${draft.trim()}` : draft.trim();
    update({ reflectAnswers: { ...data.reflectAnswers, 0: stitched }, reflectIndex: 0 });
    setStage("open");
  }
  function submitOpen() {
    const val = draft.trim();
    const i = openIdx;
    const isLastOpen = i === remaining.length - 1;
    update({ reflectAnswers: { ...data.reflectAnswers, [i + 1]: val } });
    if (isLastOpen) {
      update({ reflectIndex: i + 1 });
      setStage("mentor");
    } else {
      revealThen(phase.reflectResponses[i] ?? "Good. Keep going.", () => update({ reflectIndex: i + 1 }));
    }
  }
}

function firstDiagram(data: PhaseState): string | null {
  for (const o of Object.values(data.diagramOutputs)) if (o.image) return o.image;
  return null;
}

function Square({ src, empty }: { src: string | null; empty: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-stone-200 bg-stone-50 aspect-square flex items-center justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-contain" />
      ) : (
        <p className="text-xs text-stone-400 px-3 text-center line-clamp-4">{empty}</p>
      )}
    </div>
  );
}

// --- Synthesis (Concept only) -----------------------------------------------

export function conceptTemplate(q: Record<string | number, string>): string {
  const t = q[0] ?? "space";
  const s = q[1] ?? "a considered atmosphere";
  const n = q[2] ?? "a central idea";
  const a = q[3] ?? "spatial intention";
  const i = q[4];
  if (i && i.trim().length > 10) {
    const e = i.trim().replace(/^this space is fundamentally about\s*/i, "");
    return `This ${t.toLowerCase()} project is fundamentally about ${e}. It pursues a sense of ${s.toLowerCase()}, expressed through ${a.toLowerCase()}.`;
  }
  return `This ${t.toLowerCase()} project explores ${n.toLowerCase()}, responding to a need for ${s.toLowerCase()}, expressed through ${a.toLowerCase()}.`;
}

function SynthesisStep({
  phase,
  sessionId,
  data,
  update,
  onBack,
  onDone,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: Update;
  onBack: () => void;
  onDone: () => void;
}) {
  const q = data.thinkAnswers;
  const Q1 = q[0] ?? "";
  const Q2 = q[1] ?? "";
  const Q3 = q[2] ?? "";
  const Q4 = q[3] ?? "";
  const Q5 = q[4] ?? "";
  const driver = q[99] ?? "";
  const compare = q[98] ?? "";
  const template = useMemo(() => conceptTemplate(q), [q]);
  const [refining, setRefining] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (data.aiConceptStatement !== null || fired.current) return;
    fired.current = true;
    setRefining(true);
    fetch("/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        nodeId: phase.id,
        step: "synthesis-refine",
        prompt: `You are an interior design studio mentor. A student produced this concept statement:\n\n"${template}"\n\nTheir core idea: ${Q3}\nTheir spatial translation: ${Q4}\nTheir design driver: ${driver}\n\nRewrite this as exactly 1–2 sentences. Be precise and specific. Remove vague words. Keep it under 40 words total. No padding. Do not start with "This project".`,
        query: `${Q3} ${Q4}`.trim() || template,
        temperature: 0.5,
        maxTokens: 120,
      }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { feedback?: string };
        const t = (j.feedback ?? "").trim();
        update({ aiConceptStatement: t.length > 10 ? t : template });
      })
      .catch(() => update({ aiConceptStatement: template }))
      .finally(() => setRefining(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statement = data.aiConceptStatement ?? template;
  const aiRefined = data.aiConceptStatement != null && data.aiConceptStatement !== template;
  const actText =
    data.actText ||
    Object.values(data.diagramOutputs).map((o) => o.text).filter(Boolean).join(" ");
  const suggestions = spatialTranslationFor(`${Q3} ${Q5} ${actText}`);
  const ok = (s: string, n: number) => !!s && s.trim().length >= n;
  const criteria = [
    { label: "Clear central idea", ok: ok(Q3, 15) },
    { label: "Defined context", ok: ok(Q1, 3) },
    { label: "Emotional / experiential intent", ok: ok(Q2, 5) },
    { label: "Spatial translation", ok: ok(Q4, 15) },
  ];
  const okCount = criteria.filter((c) => c.ok).length;
  const strip = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  return (
    <div className="min-h-[calc(100vh-57px)] px-6 py-14">
      <div className="max-w-2xl mx-auto space-y-10 step-enter">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <button type="button" onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
              ← Back
            </button>
            <Kicker tone="mid">Concept Synthesis</Kicker>
          </div>
          <h1 className="text-3xl font-light text-stone-900">Your concept, distilled.</h1>
          <p className="text-sm text-stone-400 leading-relaxed">This is what you built. Read it carefully before moving forward.</p>
        </div>

        <section className="border border-stone-200 rounded-xl p-7 space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel n="01" title="Concept Statement" />
            {refining ? (
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="inline-block w-3 h-3 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin" />
                Refining…
              </span>
            ) : aiRefined ? (
              <span className="text-xs text-stone-400 italic">AI-refined</span>
            ) : null}
          </div>
          <p className="text-lg font-light text-stone-800 leading-relaxed">“{statement}”</p>
          {driver && (
            <p className="text-xs text-stone-400">
              Primary driver: <span className="text-stone-600 font-medium">{driver}</span>
            </p>
          )}
        </section>

        <section className="border border-stone-200 rounded-xl p-7 space-y-5">
          <SectionLabel n="02" title="Presentation Script" />
          <p className="text-xs text-stone-400 leading-relaxed">Use these lines to present your concept verbally. Each should take 10–15 seconds.</p>
          <div className="space-y-4">
            <ScriptLine prefix="My project is about" value={strip(Q5 || Q3 || actText.slice(0, 80))} />
            <ScriptLine prefix="It responds to" value={Q2 ? `a need for ${Q2.toLowerCase()}` : ""} />
            <ScriptLine prefix="The key idea I'm exploring is" value={strip(Q3)} />
            <ScriptLine prefix="This is expressed through" value={strip(Q4 || actText.slice(0, 60))} />
          </div>
        </section>

        <section className="border border-stone-200 rounded-xl p-7 space-y-5">
          <div className="flex items-center justify-between">
            <SectionLabel n="03" title="Concept Strength Check" />
            <span className="text-xs text-stone-400">{okCount} / {criteria.length} complete</span>
          </div>
          <div className="space-y-3">
            {criteria.map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.ok ? "bg-stone-600" : "bg-amber-400"}`} />
                <span className="text-sm text-stone-700 flex-1">{c.label}</span>
                <span className={`text-xs font-medium ${c.ok ? "text-stone-500" : "text-amber-600"}`}>{c.ok ? "Complete" : "Developing"}</span>
              </div>
            ))}
          </div>
          {okCount < 3 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 leading-relaxed">
              Some areas need more work before you move to zoning. You can return to the Think step and strengthen your answers.
            </p>
          )}
        </section>

        <section className="border border-stone-200 rounded-xl p-7 space-y-5">
          <SectionLabel n="04" title="Spatial Translation Opportunities" />
          <p className="text-xs text-stone-400 leading-relaxed">Based on your concept, these are the spatial moves worth exploring in zoning.</p>
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="text-stone-300 mt-0.5 flex-shrink-0">→</span>
                <span className="text-sm text-stone-700 leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
          {compare && (
            <div className="border-t border-stone-100 pt-4 space-y-1">
              <Kicker>Your self-assessment</Kicker>
              <p className="text-xs text-stone-500 leading-relaxed italic">“{compare}”</p>
            </div>
          )}
        </section>

        <section className="bg-stone-900 rounded-xl p-7 space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">Next Phase</p>
            <h3 className="text-xl font-light text-white">Now test this concept through space.</h3>
          </div>
          <p className="text-sm text-stone-400 leading-relaxed">
            In the Zoning Phase, you will translate this concept into spatial organisation — defining zones, circulation, and hierarchy. Every decision should trace back to what you just wrote above.
          </p>
          <div className="border border-stone-700 rounded-lg px-4 py-3">
            <p className="text-xs text-stone-400 mb-1">Your concept</p>
            <p className="text-sm text-stone-300 leading-relaxed italic">“{statement}”</p>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={onDone}
              className="bg-white text-stone-900 text-sm font-medium px-7 py-3 rounded-md hover:bg-stone-100 transition-colors duration-200"
            >
              Finish Concept phase →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-stone-300">{n}</span>
      <h2 className="text-sm font-medium tracking-wide text-stone-600 uppercase">{title}</h2>
    </div>
  );
}

function ScriptLine({ prefix, value }: { prefix: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-stone-400">{prefix}…</p>
      <p className="text-base font-light text-stone-800 leading-snug pl-3 border-l-2 border-stone-200">
        {value || <span className="text-stone-300 italic">not answered</span>}
      </p>
    </div>
  );
}

// --- End (malzama's per-phase summary) --------------------------------------

function EndStep({ phase, sessionId, data }: { phase: Phase; sessionId: number; data: PhaseState }) {
  const reflections: Array<{ q: string; a: string }> = [];
  if (data.reflectAnswers[97]) reflections.push({ q: "Looking at your work now, what would you change?", a: data.reflectAnswers[97] });
  if (data.reflectAnswers[0]) reflections.push({ q: phase.reflection[0], a: data.reflectAnswers[0] });
  for (let i = 1; i < phase.reflection.length; i++) {
    const a = data.reflectAnswers[i];
    if (a?.trim()) reflections.push({ q: phase.reflection[i], a });
  }
  const diagrams = Object.entries(data.diagramOutputs).filter(([, o]) => o.image || o.text);
  const missionTitle = (key: string) => phase.missions?.find((m) => m.outputKey === key)?.title ?? key;

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-14 step-enter">
        <div className="space-y-3 text-center">
          <Kicker tone="mid">Phase Complete</Kicker>
          <h2 className="text-3xl font-light text-stone-900">{phase.title}</h2>
          <p className="text-base text-stone-400 font-light">You completed the full cycle.</p>
        </div>

        {data.aiConceptStatement && (
          <div className="border border-stone-200 rounded-lg p-6 space-y-2">
            <Kicker tone="mid">Concept statement</Kicker>
            <p className="text-stone-800 text-base leading-relaxed font-light">“{data.aiConceptStatement}”</p>
          </div>
        )}

        {data.aiFeedback && (
          <div className="border border-stone-200 rounded-lg p-6 space-y-2 step-enter-slow">
            <Kicker tone="mid">Mentor Feedback</Kicker>
            <p className="text-stone-700 text-base leading-relaxed italic font-light">“{data.aiFeedback}”</p>
          </div>
        )}

        <div className="space-y-5">
          <SummaryHeading>Your Thinking</SummaryHeading>
          {phase.questions.map((qText, i) => {
            const a = data.thinkAnswers[i];
            return a?.trim() ? <QA key={i} q={qText} a={a} /> : null;
          })}
          {data.thinkAnswers[99] && <QA q={phase.driverQuestion} a={data.thinkAnswers[99]} />}
          {data.thinkAnswers[98] && <QA q={phase.compareQuestion} a={data.thinkAnswers[98]} />}
        </div>

        {(data.userSketch || data.actImageUrl || diagrams.length > 0) && (
          <div className="space-y-4">
            <SummaryHeading>Your Visual Journey</SummaryHeading>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs text-stone-400">Initial sketch</p>
                <Square src={data.userSketch} empty="Not uploaded" />
                {data.userSketchNote && <p className="text-xs text-stone-400 line-clamp-2">{data.userSketchNote}</p>}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-stone-400">Final output</p>
                <Square src={data.actImageUrl ?? firstDiagram(data)} empty={data.actText || "—"} />
              </div>
            </div>
            {diagrams.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {diagrams.map(([k, o]) => (
                  <div key={k} className="space-y-1.5">
                    <p className="text-xs text-stone-400">{missionTitle(k)}</p>
                    <Square src={o.image} empty={o.text || "—"} />
                    {o.text && <p className="text-xs text-stone-500 line-clamp-2">{o.text}</p>}
                  </div>
                ))}
              </div>
            )}
            {data.actText && <p className="text-sm text-stone-600 leading-relaxed">{data.actText}</p>}
          </div>
        )}

        {reflections.length > 0 && (
          <div className="space-y-5">
            <SummaryHeading>Your Reflection</SummaryHeading>
            {reflections.map((r, i) => (
              <QA key={i} q={r.q} a={r.a} />
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-stone-100 flex flex-col items-center gap-3">
          <Link
            href={`/studio/${sessionId}`}
            className="inline-block bg-stone-900 text-white text-sm font-medium px-8 py-3.5 rounded-md hover:bg-stone-700 transition-colors duration-200"
          >
            {phase.id === "concept" ? "Continue to Zoning →" : "Back to session →"}
          </Link>
          <Link href={`/studio/${sessionId}/receipt`} className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2">
            View session receipt
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-widest text-stone-400 uppercase border-b border-stone-100 pb-3">{children}</p>
  );
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-stone-400 leading-snug">{q}</p>
      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{a}</p>
    </div>
  );
}

// --- Primitives -------------------------------------------------------------

const INPUT =
  "w-full border border-stone-200 rounded-lg px-4 py-3 text-base text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 transition-colors bg-white";
const TEXTAREA =
  "w-full border border-stone-200 rounded-lg px-4 py-3.5 text-base text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400 resize-none leading-relaxed transition-colors bg-white";

function Kicker({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "mid" }) {
  return (
    <p className={`text-xs font-medium tracking-widest uppercase ${tone === "mid" ? "text-stone-400" : "text-stone-300"}`}>
      {children}
    </p>
  );
}

function Reveal({ message }: { message: string }) {
  return (
    <div className="text-center py-6 response-reveal">
      <p className="text-2xl font-light text-stone-500">{message}</p>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  compact,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bg-stone-900 text-white text-sm font-medium rounded-md hover:bg-stone-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors duration-200 ${compact ? "px-6 py-2.5" : "px-7 py-3"}`}
    >
      {children}
    </button>
  );
}

function ChoiceButton({
  onClick,
  selected,
  dim,
  children,
}: {
  onClick: () => void;
  selected?: boolean;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dim}
      className={`px-4 py-4 rounded-lg border text-sm font-medium text-left leading-snug transition-all duration-200 ${
        selected
          ? "border-stone-900 bg-stone-900 text-white scale-[0.98]"
          : dim
            ? "border-stone-100 text-stone-300 cursor-not-allowed"
            : "border-stone-200 text-stone-700 hover:border-stone-400 hover:bg-stone-50 active:scale-[0.97] bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function DropZone({
  onFile,
  busy,
  big,
  children,
}: {
  onFile: (f: File) => void;
  busy?: boolean;
  big?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => !busy && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg ${big ? "p-10" : "p-6"} text-center cursor-pointer transition-colors ${
        hover ? "border-stone-500 bg-stone-50" : "border-stone-200 hover:border-stone-400 hover:bg-stone-50"
      } ${busy ? "opacity-60 cursor-wait" : ""}`}
    >
      {big && (
        <div className="mx-auto mb-4 w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12V4M9 4L6 7M9 4L12 7" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 14h12" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {busy ? <p className="text-sm text-stone-400">Uploading…</p> : children}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

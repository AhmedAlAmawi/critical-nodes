"use client";

/**
 * The malzama-lineage phase runner — drives a Concept or Zoning phase end-to-end:
 *   Orient (3) → Sketch → Think (dynamic, with driver + compare + insights)
 *   → Act → Reflect (recap → visual recall → choice → why → open Qs → AI mentor)
 *   → Synthesis (Concept only) → End
 *
 * Persists every state change into session_node_state via useSessionState,
 * which is the v3 server-backed replacement for the v2 localStorage hook.
 * Calls /api/mentor at the end of Reflect (grounded by assignment scope).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Phase, PhaseState, Mission } from "@/lib/phases/types";
import { emptyPhaseState } from "@/lib/phases/types";
import { useSessionState } from "@/lib/use-session-state";
import { spatialTranslationFor } from "@/lib/phases/spatial-translation-keywords";

type Props = { sessionId: number; phase: Phase };

type ThinkStep =
  | { kind: "question"; index: number }
  | { kind: "select"; index: number }
  | { kind: "driver" }
  | { kind: "compare" };

/** Build the Think step list per malzama's function `b()`. */
function buildThinkSteps(phase: Phase): ThinkStep[] {
  const steps: ThinkStep[] = [];
  let driverInjected = false;
  for (let i = 0; i < phase.questions.length; i++) {
    const opts = phase.questionOptions[i];
    const step: ThinkStep = opts
      ? { kind: "select", index: i }
      : { kind: "question", index: i };
    steps.push(step);
    if (!driverInjected && step.kind === "select") {
      steps.push({ kind: "driver" });
      if (phase.compareQuestion) steps.push({ kind: "compare" });
      driverInjected = true;
    }
  }
  if (!driverInjected) {
    // No selects — inject after Q2.
    steps.splice(2, 0, { kind: "driver" });
    if (phase.compareQuestion) steps.splice(3, 0, { kind: "compare" });
  }
  return steps;
}

export function PhaseRunner({ sessionId, phase }: Props) {
  const sst = useSessionState(sessionId);
  const data = (sst.getNode<PhaseState>(phase.id) ?? emptyPhaseState()) as PhaseState;

  const update = useCallback(
    (patch: Partial<PhaseState>, completed?: boolean) => {
      sst.setNode(phase.id, { ...data, ...patch }, { completed });
    },
    [sst, phase.id, data],
  );

  const thinkSteps = useMemo(() => buildThinkSteps(phase), [phase]);

  if (sst.status === "loading") {
    return <Centered>Loading…</Centered>;
  }
  if (sst.status === "error") {
    return <Centered>Failed to load: {sst.error}</Centered>;
  }

  // Sticky pill stepper (concept: 7, zoning: 6 — no synthesis on zoning).
  const stepperItems =
    phase.id === "concept"
      ? ["orient", "sketch", "think", "act", "reflect", "synthesis", "end"]
      : ["orient", "sketch", "think", "act", "reflect", "end"];

  return (
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href={`/studio/${sessionId}`} className="text-xs text-stone-500 hover:text-stone-900">
          ← Session
        </Link>
        <h1 className="text-3xl font-serif mt-2">{phase.title}</h1>
        <p className="text-xs text-stone-500 mt-1">{phase.subtitle}</p>
      </header>

      <Stepper items={stepperItems} active={data.step} />

      <section className="mt-8">
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
            data={data}
            update={update}
            onContinue={() => update({ step: "think", thinkIndex: 0 })}
          />
        )}
        {data.step === "think" && (
          <ThinkStepView
            phase={phase}
            steps={thinkSteps}
            data={data}
            update={update}
            onDone={() => update({ step: "act" })}
          />
        )}
        {data.step === "act" && (
          <ActStep
            phase={phase}
            data={data}
            update={update}
            onContinue={() => update({ step: "reflect", reflectIndex: 0 })}
          />
        )}
        {data.step === "reflect" && (
          <ReflectStep
            phase={phase}
            sessionId={sessionId}
            data={data}
            update={update}
            onDone={() =>
              update(
                {
                  step: phase.id === "concept" ? "synthesis" : "end",
                },
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
            onDone={() => update({ step: "end" }, true)}
          />
        )}
        {data.step === "end" && <EndStep phase={phase} sessionId={sessionId} />}
      </section>
    </main>
  );
}

// --- Stepper ----------------------------------------------------------------

function Stepper({
  items,
  active,
}: {
  items: string[];
  active: string;
}) {
  const idx = items.indexOf(active);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-widest">
      {items.map((it, i) => (
        <li
          key={it}
          className={`rounded-full px-2 py-0.5 ${
            i === idx
              ? "bg-stone-900 text-white"
              : i < idx
                ? "bg-stone-100 text-stone-700"
                : "bg-stone-50 text-stone-400"
          }`}
        >
          {i < idx ? "✓ " : ""}
          {it}
        </li>
      ))}
    </ol>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center text-sm text-stone-500">
      {children}
    </main>
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
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onDone: () => void;
}) {
  const next = () => {
    if (data.orientStep === 2) onDone();
    else update({ orientStep: ((data.orientStep + 1) as 1 | 2) });
  };
  return (
    <div className="space-y-5">
      <ProgressBar pct={(data.orientStep + 1) * 33} />
      {data.orientStep === 0 && (
        <Card title={phase.title}>
          <p className="text-sm leading-relaxed">{phase.conceptDefinition}</p>
        </Card>
      )}
      {data.orientStep === 1 && (
        <Card title="Strong example">
          <p className="text-sm leading-relaxed italic">{phase.example}</p>
          <p className="text-sm leading-relaxed mt-3">
            <span className="text-xs uppercase tracking-widest text-stone-500">
              Why it works
            </span>
            <br />
            {phase.exampleExplanation}
          </p>
        </Card>
      )}
      {data.orientStep === 2 && (
        <Card title="Academic reference">
          <p className="text-sm italic leading-relaxed">
            {phase.academic.insight}
          </p>
          <p className="text-xs text-stone-500 mt-2">— {phase.academic.source}</p>
        </Card>
      )}
      <PrimaryButton onClick={next}>
        {data.orientStep === 0
          ? "Show me an example →"
          : data.orientStep === 1
            ? "Makes sense →"
            : "I'm ready to think →"}
      </PrimaryButton>
    </div>
  );
}

// --- Sketch ------------------------------------------------------------------

function SketchStep({
  data,
  update,
  onContinue,
}: {
  phase: Phase;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onContinue: () => void;
}) {
  const inputId = "sketch-file";
  async function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      update({ userSketch: String(reader.result) });
    };
    reader.readAsDataURL(file);
  }
  return (
    <div className="space-y-4">
      <Card title="Start with what you have">
        <p className="text-sm leading-relaxed">
          Upload a sketch, photo, or rough diagram of your current idea. It
          doesn&rsquo;t need to be finished — it just needs to exist.
        </p>
        <p className="text-xs text-stone-500 mt-2">PNG, JPG, HEIC, PDF — any format</p>
      </Card>

      {data.userSketch ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={data.userSketch}
          alt="Your sketch"
          className="rounded-2xl border border-stone-200 max-h-80 object-contain bg-stone-50"
        />
      ) : (
        <label
          htmlFor={inputId}
          className="block rounded-2xl border-2 border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500 cursor-pointer hover:border-stone-500"
        >
          Drop or click to upload
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      <input
        value={data.userSketchNote}
        onChange={(e) => update({ userSketchNote: e.target.value })}
        placeholder="— what is this sketch about?"
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={onContinue} disabled={!data.userSketch}>
          Continue to Think →
        </PrimaryButton>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:border-stone-500"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// --- Think ------------------------------------------------------------------

function ThinkStepView({
  phase,
  steps,
  data,
  update,
  onDone,
}: {
  phase: Phase;
  steps: ThinkStep[];
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onDone: () => void;
}) {
  const [revealing, setRevealing] = useState<string | null>(null);
  const current = steps[data.thinkIndex];
  if (!current) {
    onDone();
    return null;
  }

  function advance(answer: string, response?: string) {
    const key =
      current.kind === "driver"
        ? 99
        : current.kind === "compare"
          ? 98
          : current.index;
    update({ thinkAnswers: { ...data.thinkAnswers, [key]: answer } });
    if (response) {
      setRevealing(response);
      setTimeout(() => {
        setRevealing(null);
        if (data.thinkIndex + 1 >= steps.length) onDone();
        else update({ thinkIndex: data.thinkIndex + 1 });
      }, 1350);
    } else {
      if (data.thinkIndex + 1 >= steps.length) onDone();
      else update({ thinkIndex: data.thinkIndex + 1 });
    }
  }

  if (revealing) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm italic">{revealing}</p>
      </div>
    );
  }

  if (current.kind === "question") {
    const i = current.index;
    const insight = phase.questionInsights[i];
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">{phase.questions[i]}</h2>
        {insight && <InsightCard insight={insight} userSketch={data.userSketch} />}
        <textarea
          rows={4}
          autoFocus
          placeholder="Your answer…"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              advance(
                (e.target as HTMLTextAreaElement).value.trim(),
                phase.thinkResponses[i],
              );
            }
          }}
        />
        <p className="text-xs text-stone-500">⌘/Ctrl + Enter to submit</p>
      </div>
    );
  }

  if (current.kind === "select") {
    const i = current.index;
    const opts = phase.questionOptions[i] ?? [];
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">{phase.questions[i]}</h2>
        <div className="grid grid-cols-2 gap-2">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => advance(o, phase.thinkResponses[i])}
              className="rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm hover:border-stone-900"
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (current.kind === "driver") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">{phase.driverQuestion}</h2>
        <div className="grid grid-cols-2 gap-2">
          {phase.driverOptions.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => advance(o, phase.driverResponse)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm hover:border-stone-900"
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // compare
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-serif">{phase.compareQuestion}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Figure
          src={phase.reference.image}
          caption={phase.reference.caption}
        />
        {data.userSketch ? (
          <Figure src={data.userSketch} caption="Your sketch" />
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 p-6 text-xs text-stone-500 grid place-items-center">
            No sketch uploaded
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {phase.compareOptions.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => advance(o, phase.compareResponse)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm hover:border-stone-900"
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  userSketch,
}: {
  insight: Phase["questionInsights"][number];
  userSketch: string | null;
}) {
  if (!insight) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm italic">{insight.text}</p>
      <p className="text-xs text-stone-500 mt-2">— {insight.referenceId}</p>
      {insight.compare && userSketch ? (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Figure src={insight.visual} caption={insight.caption} />
          <Figure src={userSketch} caption="Your sketch" />
        </div>
      ) : insight.visual ? (
        <Figure src={insight.visual} caption={insight.caption} />
      ) : null}
    </div>
  );
}

function Figure({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption}
        className="w-full rounded-lg border border-stone-200 max-h-48 object-contain bg-stone-50"
      />
      <figcaption className="text-[10px] text-stone-500">{caption}</figcaption>
    </figure>
  );
}

// --- Act --------------------------------------------------------------------

function ActStep({
  phase,
  data,
  update,
  onContinue,
}: {
  phase: Phase;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onContinue: () => void;
}) {
  if (phase.missions && phase.missions.length > 0) {
    return (
      <ActMissions
        phase={phase}
        data={data}
        update={update}
        onContinue={onContinue}
      />
    );
  }
  return (
    <ActSingle
      phase={phase}
      data={data}
      update={update}
      onContinue={onContinue}
    />
  );
}

function ActSingle({
  phase,
  data,
  update,
  onContinue,
}: {
  phase: Phase;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onContinue: () => void;
}) {
  const [ready, setReady] = useState(false);
  if (!ready) {
    return (
      <div className="space-y-5 text-center">
        <h2 className="text-3xl font-serif">Now stop.</h2>
        <p className="text-stone-700">Close everything else.</p>
        <p className="text-stone-700">This is the only thing right now.</p>
        <PrimaryButton onClick={() => setReady(true)}>I&rsquo;m ready →</PrimaryButton>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Card title={phase.action.instruction}>
        <p className="text-sm">{phase.action.description}</p>
      </Card>
      <textarea
        rows={6}
        autoFocus
        value={data.actText}
        onChange={(e) => update({ actText: e.target.value })}
        placeholder={phase.action.placeholder}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
      />
      <PrimaryButton onClick={onContinue} disabled={!data.actText.trim()}>
        Continue to Reflect →
      </PrimaryButton>
    </div>
  );
}

function ActMissions({
  phase,
  data,
  update,
  onContinue,
}: {
  phase: Phase;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onContinue: () => void;
}) {
  const missions: Mission[] = phase.missions ?? [];
  const [idx, setIdx] = useState(0);
  const current = missions[idx];
  if (!current) {
    onContinue();
    return null;
  }
  const output = data.diagramOutputs[current.outputKey] ?? {
    text: "",
    image: null,
  };
  function setOutput(patch: Partial<typeof output>) {
    update({
      diagramOutputs: {
        ...data.diagramOutputs,
        [current.outputKey]: { ...output, ...patch },
      },
    });
  }
  async function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setOutput({ image: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const reqMet = !current.required || output.image;

  return (
    <div className="space-y-4">
      {phase.missionsIntro && (
        <p className="text-sm text-stone-600 italic">{phase.missionsIntro}</p>
      )}
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          Mission {idx + 1} of {missions.length}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${current.required ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
        >
          {current.required ? "Required" : "Optional"}
        </span>
      </div>

      <Card title={current.title}>
        <Figure src={current.visual} caption={current.caption} />
        <p className="text-sm italic mt-3">{current.insight}</p>
        <p className="text-sm mt-3">{current.task}</p>
      </Card>

      {output.image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={output.image}
          alt=""
          className="w-full rounded-xl border border-stone-200 max-h-72 object-contain bg-stone-50"
        />
      ) : (
        <label
          htmlFor={`mission-${current.id}`}
          className="block rounded-xl border-2 border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500 cursor-pointer hover:border-stone-500"
        >
          Drop or click to upload diagram
        </label>
      )}
      <input
        id={`mission-${current.id}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <input
        value={output.text}
        onChange={(e) => setOutput({ text: e.target.value })}
        placeholder={current.placeholder}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => idx > 0 && setIdx(idx - 1)}
          disabled={idx === 0}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:border-stone-500 disabled:opacity-40"
        >
          ← Back
        </button>
        {!current.required && !output.image && (
          <button
            type="button"
            onClick={() => setIdx(idx + 1)}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm hover:border-stone-500"
          >
            Skip →
          </button>
        )}
        <PrimaryButton
          onClick={() => {
            if (idx + 1 >= missions.length) onContinue();
            else setIdx(idx + 1);
          }}
          disabled={!reqMet}
        >
          {idx + 1 >= missions.length ? "Continue to Reflect →" : "Next mission →"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// --- Reflect ----------------------------------------------------------------

function ReflectStep({
  phase,
  sessionId,
  data,
  update,
  onDone,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onDone: () => void;
}) {
  // Internal mini-machine — recap → visual recall → choice → why → opens → mentor.
  const [stage, setStage] = useState<
    "recap" | "recall" | "choice" | "why" | "open" | "mentor" | "done"
  >("recap");
  const [revealing, setRevealing] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [why, setWhy] = useState("");
  const [loadingMentor, setLoadingMentor] = useState(false);
  const reflectQuestions = phase.reflection;

  if (revealing) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm italic">{revealing}</p>
      </div>
    );
  }

  if (stage === "recap") {
    return (
      <div className="space-y-4">
        <Card title="Look at what you made">
          <p className="text-sm">Don&rsquo;t evaluate it yet. Just notice it.</p>
          {data.actText && (
            <p className="text-sm whitespace-pre-line mt-3 border-l-2 border-stone-300 pl-3 italic">
              {data.actText}
            </p>
          )}
          {data.actImageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={data.actImageUrl}
              alt=""
              className="mt-3 rounded-lg border border-stone-200 max-h-60 object-contain"
            />
          )}
        </Card>
        <PrimaryButton
          onClick={() => setStage(data.userSketch ? "recall" : "choice")}
        >
          Begin reflecting →
        </PrimaryButton>
      </div>
    );
  }

  if (stage === "recall") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">Visual recall</h2>
        <div className="grid grid-cols-2 gap-3">
          <Figure src={data.userSketch ?? ""} caption="Initial sketch" />
          {data.actImageUrl ? (
            <Figure src={data.actImageUrl} caption="What you produced" />
          ) : (
            <div className="rounded-xl border border-dashed border-stone-300 p-6 text-xs text-stone-500 grid place-items-center">
              No image produced
            </div>
          )}
        </div>
        <p className="text-sm">Looking at your work now, what would you change?</p>
        <textarea
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              update({
                reflectAnswers: {
                  ...data.reflectAnswers,
                  97: (e.target as HTMLTextAreaElement).value.trim(),
                },
              });
              setStage("choice");
            }
          }}
        />
        <p className="text-xs text-stone-500">⌘/Ctrl + Enter to submit</p>
      </div>
    );
  }

  if (stage === "choice") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">{reflectQuestions[0]}</h2>
        <div className="grid grid-cols-3 gap-2">
          {phase.reflectChoices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setChoice(c);
                setStage("why");
              }}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm hover:border-stone-900"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "why") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">Why?</h2>
        <input
          value={why}
          autoFocus
          onChange={(e) => setWhy(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update({
                reflectAnswers: {
                  ...data.reflectAnswers,
                  0: `${choice} — ${why}`,
                },
              });
              setStage("open");
            }
          }}
          placeholder="A few words is enough"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
        />
        <p className="text-xs text-stone-500">Enter to submit</p>
      </div>
    );
  }

  if (stage === "open") {
    const remaining = reflectQuestions.slice(1);
    const i = data.reflectIndex; // 0-based within `remaining`
    const q = remaining[i];
    if (!q) {
      setStage("mentor");
      return null;
    }
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-serif">{q}</h2>
        <textarea
          rows={4}
          autoFocus
          placeholder="Your answer…"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              const val = (e.target as HTMLTextAreaElement).value.trim();
              update({
                reflectAnswers: {
                  ...data.reflectAnswers,
                  [i + 1]: val,
                },
                reflectIndex: i + 1,
              });
              const resp = phase.reflectResponses[i];
              if (resp) {
                setRevealing(resp);
                setTimeout(() => setRevealing(null), 1350);
              }
            }
          }}
        />
        <p className="text-xs text-stone-500">⌘/Ctrl + Enter to submit</p>
      </div>
    );
  }

  if (stage === "mentor") {
    if (loadingMentor) {
      return (
        <Centered>
          <p>Getting mentor feedback…</p>
        </Centered>
      );
    }
    if (data.aiFeedback === null) {
      // Trigger the call exactly once.
      setLoadingMentor(true);
      const promptText = [
        `Phase: ${phase.title}`,
        `Student's thinking: ${Object.values(data.thinkAnswers).join(" / ")}`,
        `Student's output: ${data.actText}`,
        `Student's reflection: ${Object.values(data.reflectAnswers).join(" / ")}`,
      ].join("\n");
      fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          nodeId: phase.id,
          step: "reflect-end",
          prompt: promptText,
          query: `${data.actText}\n\n${Object.values(data.thinkAnswers).slice(0, 3).join(" ")}`,
          temperature: 0.7,
        }),
      })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as {
            feedback?: string;
            citations?: Array<{ chunkId: number; sourceId: number; page: number | null }>;
          };
          update({
            aiFeedback: j.feedback ?? "",
            aiFeedbackCitations: j.citations ?? [],
          });
        })
        .catch(() => update({ aiFeedback: "" }))
        .finally(() => setLoadingMentor(false));
      return (
        <Centered>
          <p>Getting mentor feedback…</p>
        </Centered>
      );
    }
    return (
      <div className="space-y-4">
        <Card title="Mentor">
          {data.aiFeedback ? (
            <p className="text-sm italic leading-relaxed">{data.aiFeedback}</p>
          ) : (
            <p className="text-sm text-stone-500">No feedback available.</p>
          )}
          {data.aiFeedbackCitations.length > 0 && (
            <div className="mt-3 text-xs text-stone-500 flex flex-wrap gap-2">
              {data.aiFeedbackCitations.map((c) => (
                <span
                  key={c.chunkId}
                  className="rounded-full bg-stone-100 px-2 py-0.5"
                  title={`source ${c.sourceId} p.${c.page ?? "—"}`}
                >
                  #{c.chunkId}
                </span>
              ))}
            </div>
          )}
        </Card>
        <PrimaryButton onClick={onDone}>
          {phase.id === "concept" ? "Continue to Synthesis →" : "Finish phase →"}
        </PrimaryButton>
      </div>
    );
  }

  return null;
}

// --- Synthesis (Concept only) -----------------------------------------------

function SynthesisStep({
  phase,
  sessionId,
  data,
  update,
  onDone,
}: {
  phase: Phase;
  sessionId: number;
  data: PhaseState;
  update: (p: Partial<PhaseState>, c?: boolean) => void;
  onDone: () => void;
}) {
  const q = data.thinkAnswers as Record<string | number, string>;
  const Q1 = q[0] ?? "";
  const Q2 = q[1] ?? "";
  const Q3 = q[2] ?? "";
  const Q4 = q[3] ?? "";
  const Q5 = q[4] ?? "";
  const driver = q[99] ?? "";

  const template = useMemo(() => {
    const sp = (Q1 || "space").toLowerCase();
    return `This ${sp} project is fundamentally about ${Q5 || Q3 || "an idea"}. It pursues a sense of ${Q2.toLowerCase()}, expressed through ${Q4 || "spatial decisions"}.`;
  }, [Q1, Q2, Q3, Q4, Q5]);

  const [refining, setRefining] = useState(false);

  useEffect(() => {
    if (data.aiConceptStatement !== null) return;
    if (!template) return;
    setRefining(true);
    fetch("/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        nodeId: phase.id,
        step: "synthesis-refine",
        prompt: `Rewrite this concept statement: "${template}". Core idea: ${Q3}. Spatial translation: ${Q4}. Design driver: ${driver}. Make it exactly 1-2 sentences, under 40 words, no padding. Do not start with "This project".`,
        query: `${Q3} ${Q4}`,
        temperature: 0.5,
        maxTokens: 120,
      }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { feedback?: string };
        update({ aiConceptStatement: j.feedback ?? template });
      })
      .catch(() => update({ aiConceptStatement: template }))
      .finally(() => setRefining(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statement = data.aiConceptStatement ?? template;
  const suggestions = spatialTranslationFor(`${Q3} ${Q5} ${data.actText}`);

  const criteria = [
    { label: "Clear central idea", ok: (Q3?.length ?? 0) >= 15 },
    { label: "Defined context", ok: (Q1?.length ?? 0) >= 3 },
    { label: "Emotional / experiential intent", ok: (Q2?.length ?? 0) >= 5 },
    { label: "Spatial translation", ok: (Q4?.length ?? 0) >= 15 },
  ];
  const okCount = criteria.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      <SectionLabel n={1} title="Concept Statement" />
      <Card>
        <p className="text-sm leading-relaxed">{statement}</p>
        <p className="text-xs text-stone-500 mt-2">
          {refining ? "Refining…" : data.aiConceptStatement ? "AI-refined" : "Template"}
        </p>
      </Card>

      <SectionLabel n={2} title="Presentation Script" />
      <Card>
        <ul className="space-y-2 text-sm">
          <li>My project is about… {Q5 || Q3 || data.actText.slice(0, 80)}</li>
          <li>It responds to… a need for {Q2.toLowerCase()}</li>
          <li>The key idea I&rsquo;m exploring is… {Q3}</li>
          <li>This is expressed through… {Q4 || data.actText.slice(0, 60)}</li>
        </ul>
      </Card>

      <SectionLabel n={3} title="Concept Strength Check" />
      <Card>
        <ul className="space-y-1 text-sm">
          {criteria.map((c) => (
            <li key={c.label} className="flex items-center justify-between">
              <span>{c.label}</span>
              <span
                className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 ${c.ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
              >
                {c.ok ? "Complete" : "Developing"}
              </span>
            </li>
          ))}
        </ul>
        {okCount < 3 && (
          <p className="mt-2 text-xs text-amber-700">
            Consider returning to Think to strengthen the developing criteria.
          </p>
        )}
      </Card>

      <SectionLabel n={4} title="Spatial Translation Opportunities" />
      <Card>
        <ul className="list-disc pl-5 text-sm space-y-1">
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      <PrimaryButton onClick={onDone}>Finish Concept phase →</PrimaryButton>
    </div>
  );
}

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-xs uppercase tracking-widest text-stone-500">
      0{n} · {title}
    </p>
  );
}

// --- End --------------------------------------------------------------------

function EndStep({ phase, sessionId }: { phase: Phase; sessionId: number }) {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-serif">Phase complete</h2>
      <p className="text-sm text-stone-600">
        {phase.title} is done. Continue through your session to the next stage.
      </p>
      <Link
        href={`/studio/${sessionId}`}
        className="inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Back to session →
      </Link>
    </div>
  );
}

// --- Primitives -------------------------------------------------------------

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      {title && (
        <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-25 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
      <div
        className="h-full bg-stone-900 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

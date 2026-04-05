"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Image as ImageIcon, ArrowRight, Trash2, AlertTriangle, Check, CircleDot, Upload, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, getActiveSession, type ReferenceBreakdown, type BorrowingCategory, BORROWING_CATEGORIES } from "@/lib/store";
import { validateTextField, crossCheckEmotionalTone } from "@/lib/validation";
import { checkReferenceAlignment, evaluateSketch } from "@/lib/ai-advisory";
import { processImageFile } from "@/lib/image-utils";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell } from "@/components/node-shell";
import { cn } from "@/lib/utils";

const MAX_REFERENCES = 2;

function createEmptyBreakdown(): ReferenceBreakdown {
  return { id: crypto.randomUUID(), lens: "", framing: "", tone: "", grain: "", colorTemperature: "", notBorrowing: "", emotion: "", borrowingCategories: [], annotationSketchBase64: null, annotationFeedback: null };
}

type BreakdownErrors = Partial<Record<keyof ReferenceBreakdown | "borrowing", string[]>>;

function BField({ label, value, onChange, errors, placeholder }: { label: string; value: string; onChange: (v: string) => void; errors?: string[]; placeholder?: string }) {
  const filled = value.trim().length >= 5;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={cn("w-3 h-3 rounded-full flex items-center justify-center shrink-0", filled ? "bg-warm/20" : "bg-foreground/[0.04]")}>
          {filled ? <Check className="w-2 h-2 text-warm" strokeWidth={3} /> : <CircleDot className="w-2 h-2 text-muted-foreground/30" />}
        </div>
        <label className="block text-[11px] font-medium text-foreground/80">{label}</label>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[36px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" />
      {errors?.map((e, i) => <p key={i} className="text-[11px] text-destructive pl-5">{e}</p>)}
    </div>
  );
}

function countBreakdownFields(b: ReferenceBreakdown): number {
  let c = 0;
  if (b.lens.trim().length >= 5) c++;
  if (b.framing.trim().length >= 5) c++;
  if (b.tone.trim().length >= 5) c++;
  if (b.grain.trim().length >= 5) c++;
  if (b.colorTemperature.trim().length >= 5) c++;
  if (b.notBorrowing.trim().length >= 10) c++;
  if (b.emotion.trim().length >= 5) c++;
  if (b.borrowingCategories.length > 0) c++;
  return c;
}

export function ReferenceDeconstruction() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [breakdowns, setBreakdowns] = useState<ReferenceBreakdown[]>(
    session?.referenceBreakdowns?.length ? session.referenceBreakdowns : [createEmptyBreakdown()]
  );
  const [errors, setErrors] = useState<Record<string, BreakdownErrors>>({});
  const [toneWarning, setToneWarning] = useState<string | null>(null);
  const [alignmentAlerts, setAlignmentAlerts] = useState<Record<string, string | null>>({});
  const [annotationLoading, setAnnotationLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (session?.referenceBreakdowns?.length) setBreakdowns(session.referenceBreakdowns);
  }, [session?.referenceBreakdowns]);

  useEffect(() => {
    if (!session?.intent) return;
    breakdowns.forEach((b) => {
      const hasEnoughData = b.emotion.trim().length >= 5 && b.borrowingCategories.length > 0;
      if (hasEnoughData && !alignmentAlerts[b.id]) {
        checkAlignment(b);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdowns.map((b) => `${b.emotion}|${b.borrowingCategories.join(",")}`).join(":")]);

  const totalCompleted = useMemo(() => breakdowns.reduce((s, b) => s + countBreakdownFields(b), 0), [breakdowns]);
  const totalFields = breakdowns.length * 8;

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (state.referenceImages.length >= MAX_REFERENCES) return;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      dispatch({ type: "ADD_REFERENCE_IMAGE", payload: { id, file, preview, base64: null, mimeType: null, processing: false } });
    });
  };

  const handleRemoveImage = (id: string) => {
    const img = state.referenceImages.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    dispatch({ type: "REMOVE_REFERENCE_IMAGE", payload: id });
  };

  function updateBreakdown(id: string, field: keyof ReferenceBreakdown, value: string | BorrowingCategory[]) {
    setBreakdowns((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    if (errors[id]?.[field]) setErrors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: undefined } }));
    if (field === "emotion" && session?.intent?.emotionalAtmosphere && typeof value === "string") {
      setToneWarning(crossCheckEmotionalTone(value, session.intent.emotionalAtmosphere));
    }
  }

  function toggleBorrowing(id: string, category: BorrowingCategory) {
    setBreakdowns((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const cats = b.borrowingCategories.includes(category)
        ? b.borrowingCategories.filter((c) => c !== category)
        : [...b.borrowingCategories, category];
      return { ...b, borrowingCategories: cats };
    }));
    if (errors[id]?.borrowing) setErrors((prev) => ({ ...prev, [id]: { ...prev[id], borrowing: undefined } }));
  }

  const handleAnnotationUpload = useCallback(async (breakdownId: string, files: File[]) => {
    const file = files[0];
    if (!file) return;
    setAnnotationLoading((prev) => ({ ...prev, [breakdownId]: true }));
    try {
      const processed = await processImageFile(file);
      setBreakdowns((prev) => prev.map((b) => b.id === breakdownId ? { ...b, annotationSketchBase64: processed.data } : b));
      const intent = session?.intent;
      const context = `This is an annotated reference image analysis. The student should have marked: light direction, vanishing point/camera logic, material zones, and compositional focal points. Student concept: ${intent?.conceptStatement || "not yet defined"}.`;
      const feedback = await evaluateSketch(processed.data, context);
      setBreakdowns((prev) => prev.map((b) => b.id === breakdownId ? { ...b, annotationFeedback: feedback } : b));
    } catch {
      setBreakdowns((prev) => prev.map((b) => b.id === breakdownId ? { ...b, annotationFeedback: "Unable to evaluate annotation." } : b));
    } finally {
      setAnnotationLoading((prev) => ({ ...prev, [breakdownId]: false }));
    }
  }, [session?.intent]);

  const checkAlignment = useCallback(async (breakdown: ReferenceBreakdown) => {
    if (!session?.intent) return;
    try {
      const alert = await checkReferenceAlignment(breakdown, session.intent);
      setAlignmentAlerts((prev) => ({ ...prev, [breakdown.id]: alert }));
    } catch {
      // silently fail
    }
  }, [session?.intent]);

  function addBreakdown() {
    if (breakdowns.length >= MAX_REFERENCES) return;
    setBreakdowns((prev) => [...prev, createEmptyBreakdown()]);
  }

  function removeBreakdown(id: string) {
    setBreakdowns((prev) => prev.filter((b) => b.id !== id));
  }

  function validate(): Record<string, BreakdownErrors> {
    const allErrors: Record<string, BreakdownErrors> = {};
    for (const b of breakdowns) {
      const e: BreakdownErrors = {};
      e.lens = validateTextField(b.lens, "Lens", 5);
      e.framing = validateTextField(b.framing, "Framing", 5);
      e.tone = validateTextField(b.tone, "Tone", 5);
      e.grain = validateTextField(b.grain, "Grain", 5);
      e.colorTemperature = validateTextField(b.colorTemperature, "Color temperature", 5);
      e.notBorrowing = validateTextField(b.notBorrowing, "Not borrowing", 10);
      e.emotion = validateTextField(b.emotion, "Emotion", 5);
      if (b.borrowingCategories.length === 0) e.borrowing = ["Select at least one category this reference informs."];
      const cleaned: BreakdownErrors = {};
      for (const [k, v] of Object.entries(e)) { if (v && v.length > 0) cleaned[k as keyof BreakdownErrors] = v; }
      if (Object.keys(cleaned).length > 0) allErrors[b.id] = cleaned;
    }
    return allErrors;
  }

  async function handleSubmit() {
    if (breakdowns.length === 0) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch({ type: "SET_REFERENCE_BREAKDOWNS", payload: breakdowns });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "references", snapshot: breakdowns } });

    await Promise.all(breakdowns.map((b) => checkAlignment(b)));

    dispatch({ type: "ADVANCE_NODE" });
  }

  function handleSkip() {
    dispatch({ type: "SET_REFERENCE_BREAKDOWNS", payload: breakdowns });
    dispatch({ type: "SKIP_NODE", payload: "references" });
  }

  const isSkipped = session?.skippedNodes.includes("references");

  return (
    <NodeShell
      number="03"
      title="Reference Deconstruction"
      description='Upload 1-2 reference images and deconstruct them analytically. Declare what you are borrowing — and verify alignment with your intent.'
      icon={<ImageIcon className="w-5 h-5 text-warm" />}
      totalFields={totalFields}
      completedFields={totalCompleted}
      onSkip={handleSkip}
      skipped={isSkipped}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-foreground/80">Reference Images</span>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{state.referenceImages.length}/{MAX_REFERENCES}</span>
        </div>

        {state.referenceImages.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <AnimatePresence>
              {state.referenceImages.map((img) => (
                <ImageThumbnail key={img.id} src={img.preview} alt="Reference" uploading={img.processing} onRemove={() => handleRemoveImage(img.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {state.referenceImages.length < MAX_REFERENCES && (
          <UploadZone onFiles={handleFiles} multiple maxFiles={MAX_REFERENCES} currentCount={state.referenceImages.length} compact={state.referenceImages.length > 0} label={state.referenceImages.length > 0 ? "Add reference" : "Reference images"} sublabel={state.referenceImages.length === 0 ? "Inspiration, precedent images" : undefined} />
        )}
      </div>

      {toneWarning && (
        <div className="border border-warm/30 bg-warm/[0.06] rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-warm flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            {toneWarning}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-foreground/80">Reference Breakdowns</span>
          {breakdowns.length < MAX_REFERENCES && (
            <button onClick={addBreakdown} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">+ Add</button>
          )}
        </div>

        <AnimatePresence>
          {breakdowns.map((b, idx) => {
            const bFilled = countBreakdownFields(b);
            const alert = alignmentAlerts[b.id];
            return (
              <motion.div key={b.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className={cn("rounded-xl border p-4 space-y-3 transition-all", bFilled === 8 ? "border-warm/20 bg-warm/[0.02]" : "border-foreground/[0.07] bg-foreground/[0.01]")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">Reference {idx + 1}</span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{bFilled}/8</span>
                  </div>
                  {breakdowns.length > 1 && (
                    <button onClick={() => removeBreakdown(b.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>

                {/* Selective Borrowing */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-foreground/80">
                    This reference informs (select all that apply):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BORROWING_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => toggleBorrowing(b.id, cat)}
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-md border transition-all",
                          b.borrowingCategories.includes(cat)
                            ? "bg-warm/10 border-warm/30 text-warm"
                            : "border-foreground/[0.1] text-muted-foreground hover:border-foreground/[0.2]"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {errors[b.id]?.borrowing?.map((e, i) => <p key={i} className="text-[11px] text-destructive">{e}</p>)}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <BField label="Lens" value={b.lens} onChange={(v) => updateBreakdown(b.id, "lens", v)} errors={errors[b.id]?.lens} placeholder="e.g. 24mm wide" />
                  <BField label="Framing" value={b.framing} onChange={(v) => updateBreakdown(b.id, "framing", v)} errors={errors[b.id]?.framing} placeholder="e.g. Low eye-level" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <BField label="Tone" value={b.tone} onChange={(v) => updateBreakdown(b.id, "tone", v)} errors={errors[b.id]?.tone} placeholder="e.g. Muted, desaturated" />
                  <BField label="Grain" value={b.grain} onChange={(v) => updateBreakdown(b.id, "grain", v)} errors={errors[b.id]?.grain} placeholder="e.g. Fine grain, analog" />
                </div>
                <BField label="Color Temperature" value={b.colorTemperature} onChange={(v) => updateBreakdown(b.id, "colorTemperature", v)} errors={errors[b.id]?.colorTemperature} placeholder="e.g. Warm 4000K with cool shadow tones" />
                <BField label="Emotional Tone" value={b.emotion} onChange={(v) => updateBreakdown(b.id, "emotion", v)} errors={errors[b.id]?.emotion} placeholder="e.g. Quiet domesticity, understated material richness" />
                <BField label="What are you NOT borrowing?" value={b.notBorrowing} onChange={(v) => updateBreakdown(b.id, "notBorrowing", v)} errors={errors[b.id]?.notBorrowing} placeholder="e.g. The overly styled furniture arrangement" />

                {/* Annotation sketch upload */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-foreground/80">Reference Annotation (optional)</label>
                  <p className="text-[10px] text-muted-foreground">Annotate this reference on paper: mark light direction, vanishing point, material zones, focal points. Upload a photo.</p>
                  {b.annotationSketchBase64 ? (
                    <div className="space-y-2">
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:image/jpeg;base64,${b.annotationSketchBase64}`} alt="Annotation" className="w-full h-auto max-h-[150px] object-contain bg-foreground/[0.02]" />
                      </div>
                      <button onClick={() => setBreakdowns((prev) => prev.map((bd) => bd.id === b.id ? { ...bd, annotationSketchBase64: null, annotationFeedback: null } : bd))}
                        className="text-[10px] text-muted-foreground hover:text-foreground">Remove</button>
                      {annotationLoading[b.id] && <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Evaluating...</div>}
                      {b.annotationFeedback && <div className="p-2 rounded-lg bg-warm/[0.04] border border-warm/10"><p className="text-[10px] text-foreground/70 leading-relaxed">{b.annotationFeedback}</p></div>}
                    </div>
                  ) : (
                    <UploadZone onFiles={(files) => handleAnnotationUpload(b.id, files)} compact label="Upload annotation"
                      icon={<div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"><Upload className="w-3 h-3 text-muted-foreground/60" /></div>} />
                  )}
                </div>

                {/* Alignment alert */}
                {alert && (
                  <div className="border border-amber-500/30 bg-amber-500/[0.06] rounded-lg px-3 py-2">
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {alert}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="pt-4">
        <Button onClick={handleSubmit} disabled={breakdowns.length === 0} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20">
          Save & Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </NodeShell>
  );
}

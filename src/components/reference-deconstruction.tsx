"use client";

import { useState, useEffect, useMemo } from "react";
import { Image as ImageIcon, ArrowRight, Trash2, AlertTriangle, Check, CircleDot } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, getActiveSession, type ReferenceBreakdown } from "@/lib/store";
import { validateTextField, crossCheckEmotionalTone } from "@/lib/validation";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell } from "@/components/node-shell";
import { cn } from "@/lib/utils";

const MAX_REFERENCES = 2;

function createEmptyBreakdown(): ReferenceBreakdown {
  return { id: crypto.randomUUID(), lens: "", framing: "", tone: "", grain: "", colorTemperature: "", notBorrowing: "", emotion: "" };
}

type BreakdownErrors = Partial<Record<keyof ReferenceBreakdown, string[]>>;

function BField({ label, value, onChange, errors, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; errors?: string[]; disabled?: boolean; placeholder?: string }) {
  const filled = value.trim().length >= 5;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={cn("w-3 h-3 rounded-full flex items-center justify-center shrink-0", filled ? "bg-warm/20" : "bg-foreground/[0.04]")}>
          {filled ? <Check className="w-2 h-2 text-warm" strokeWidth={3} /> : <CircleDot className="w-2 h-2 text-muted-foreground/30" />}
        </div>
        <label className="block text-[11px] font-medium text-foreground/80">{label}</label>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[36px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={disabled} />
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
  return c;
}

export function ReferenceDeconstruction() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isLocked = session ? session.currentNode !== "references" : false;

  const [breakdowns, setBreakdowns] = useState<ReferenceBreakdown[]>(
    session?.referenceBreakdowns?.length ? session.referenceBreakdowns : [createEmptyBreakdown()]
  );
  const [errors, setErrors] = useState<Record<string, BreakdownErrors>>({});
  const [toneWarning, setToneWarning] = useState<string | null>(null);

  useEffect(() => {
    if (session?.referenceBreakdowns?.length) setBreakdowns(session.referenceBreakdowns);
  }, [session?.referenceBreakdowns]);

  const totalCompleted = useMemo(() => breakdowns.reduce((s, b) => s + countBreakdownFields(b), 0), [breakdowns]);
  const totalFields = breakdowns.length * 7;

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

  function updateBreakdown(id: string, field: keyof ReferenceBreakdown, value: string) {
    setBreakdowns((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
    if (errors[id]?.[field]) setErrors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: undefined } }));
    if (field === "emotion" && session?.intent?.emotionalAtmosphere) {
      setToneWarning(crossCheckEmotionalTone(value, session.intent.emotionalAtmosphere));
    }
  }

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
      e.lens = validateTextField(b.lens, "Lens", 10);
      e.framing = validateTextField(b.framing, "Framing", 15);
      e.tone = validateTextField(b.tone, "Tone", 15);
      e.grain = validateTextField(b.grain, "Grain", 10);
      e.colorTemperature = validateTextField(b.colorTemperature, "Color temperature", 10);
      e.notBorrowing = validateTextField(b.notBorrowing, "Not borrowing", 20);
      e.emotion = validateTextField(b.emotion, "Emotion", 15);
      const cleaned: BreakdownErrors = {};
      for (const [k, v] of Object.entries(e)) { if (v && v.length > 0) cleaned[k as keyof ReferenceBreakdown] = v; }
      if (Object.keys(cleaned).length > 0) allErrors[b.id] = cleaned;
    }
    return allErrors;
  }

  function handleSubmit() {
    if (isLocked || breakdowns.length === 0) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch({ type: "SET_REFERENCE_BREAKDOWNS", payload: breakdowns });
    dispatch({ type: "ADVANCE_NODE" });
  }

  return (
    <NodeShell
      number="04"
      title="Reference Deconstruction"
      description='Upload 1-2 reference images and deconstruct them analytically. No vague "I like the vibe."'
      icon={<ImageIcon className="w-5 h-5 text-warm" />}
      totalFields={totalFields}
      completedFields={totalCompleted}
      locked={isLocked}
    >
      {/* Reference images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-foreground/80">Reference Images</span>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{state.referenceImages.length}/{MAX_REFERENCES}</span>
        </div>

        {state.referenceImages.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <AnimatePresence>
              {state.referenceImages.map((img) => (
                <ImageThumbnail key={img.id} src={img.preview} alt="Reference" uploading={img.processing} onRemove={isLocked ? undefined : () => handleRemoveImage(img.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isLocked && state.referenceImages.length < MAX_REFERENCES && (
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

      {/* Breakdown cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-foreground/80">Reference Breakdowns</span>
          {!isLocked && breakdowns.length < MAX_REFERENCES && (
            <button onClick={addBreakdown} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">+ Add</button>
          )}
        </div>

        <AnimatePresence>
          {breakdowns.map((b, idx) => {
            const bFilled = countBreakdownFields(b);
            return (
              <motion.div key={b.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className={cn("rounded-xl border p-4 space-y-3 transition-all", bFilled === 7 ? "border-warm/20 bg-warm/[0.02]" : "border-foreground/[0.07] bg-foreground/[0.01]")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">Reference {idx + 1}</span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{bFilled}/7</span>
                  </div>
                  {!isLocked && breakdowns.length > 1 && (
                    <button onClick={() => removeBreakdown(b.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <BField label="Lens" value={b.lens} onChange={(v) => updateBreakdown(b.id, "lens", v)} errors={errors[b.id]?.lens} disabled={isLocked} placeholder="e.g. 24mm wide" />
                  <BField label="Framing" value={b.framing} onChange={(v) => updateBreakdown(b.id, "framing", v)} errors={errors[b.id]?.framing} disabled={isLocked} placeholder="e.g. Low eye-level" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <BField label="Tone" value={b.tone} onChange={(v) => updateBreakdown(b.id, "tone", v)} errors={errors[b.id]?.tone} disabled={isLocked} placeholder="e.g. Muted, desaturated" />
                  <BField label="Grain" value={b.grain} onChange={(v) => updateBreakdown(b.id, "grain", v)} errors={errors[b.id]?.grain} disabled={isLocked} placeholder="e.g. Fine grain, analog" />
                </div>
                <BField label="Color Temperature" value={b.colorTemperature} onChange={(v) => updateBreakdown(b.id, "colorTemperature", v)} errors={errors[b.id]?.colorTemperature} disabled={isLocked} placeholder="e.g. Warm 4000K with cool shadow tones" />
                <BField label="Emotional Tone" value={b.emotion} onChange={(v) => updateBreakdown(b.id, "emotion", v)} errors={errors[b.id]?.emotion} disabled={isLocked} placeholder="e.g. Quiet domesticity, understated material richness" />
                <BField label="What are you NOT borrowing?" value={b.notBorrowing} onChange={(v) => updateBreakdown(b.id, "notBorrowing", v)} errors={errors[b.id]?.notBorrowing} disabled={isLocked} placeholder="e.g. The overly styled furniture arrangement" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!isLocked && (
        <div className="pt-4">
          <Button onClick={handleSubmit} disabled={breakdowns.length === 0} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20">
            Lock References
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

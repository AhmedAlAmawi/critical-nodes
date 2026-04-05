"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Eye, ArrowRight, Upload, Loader2 } from "lucide-react";
import { useApp, getActiveSession, type VisualPriorityData } from "@/lib/store";
import { validateTextField } from "@/lib/validation";
import { evaluateSketch } from "@/lib/ai-advisory";
import { processImageFile } from "@/lib/image-utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell, ChallengeCard } from "@/components/node-shell";
import { UploadZone } from "./upload-zone";

const emptyPriority: VisualPriorityData = {
  primaryFocusArea: "",
  secondaryFocusArea: "",
  sequenceThreshold: "",
  visualizationTarget: "",
  sketchBase64: null,
  sketchFeedback: null,
};

type FieldErrors = Partial<Record<keyof VisualPriorityData, string[]>>;

export function VisualPriorityLocator() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [form, setForm] = useState<VisualPriorityData>(session?.visualPriority ?? emptyPriority);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sketchLoading, setSketchLoading] = useState(false);

  useEffect(() => {
    if (session?.visualPriority) setForm(session.visualPriority);
  }, [session?.visualPriority]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (form.primaryFocusArea.trim().length >= 10) count++;
    if (form.secondaryFocusArea.trim().length >= 5) count++;
    if (form.sequenceThreshold.trim().length >= 5) count++;
    if (form.visualizationTarget.trim().length >= 10) count++;
    if (form.sketchBase64) count++;
    return count;
  }, [form]);

  function update<K extends keyof VisualPriorityData>(field: K, value: VisualPriorityData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const handleSketchUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setSketchLoading(true);
    try {
      const processed = await processImageFile(file);
      setForm((prev) => ({ ...prev, sketchBase64: processed.data }));
      const intent = session?.intent;
      const context = `This is an annotated plan/sketch marking visualization priority areas. Student concept: ${intent?.conceptStatement || "not yet defined"}. Spatial goal: ${intent?.spatialGoal || "not yet defined"}.
The student should have marked: primary focus area, secondary focus area, and any sequence or threshold worth visualizing.`;
      const feedback = await evaluateSketch(processed.data, context);
      setForm((prev) => ({ ...prev, sketchFeedback: feedback }));
    } catch {
      setForm((prev) => ({ ...prev, sketchFeedback: "Unable to evaluate sketch at this time." }));
    } finally {
      setSketchLoading(false);
    }
  }, [session?.intent]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    e.primaryFocusArea = validateTextField(form.primaryFocusArea, "Primary focus area");
    e.visualizationTarget = validateTextField(form.visualizationTarget, "Visualization target");

    const cleaned: FieldErrors = {};
    for (const [k, v] of Object.entries(e)) {
      if (v && v.length > 0) cleaned[k as keyof VisualPriorityData] = v;
    }
    return cleaned;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    dispatch({ type: "SET_VISUAL_PRIORITY_DATA", payload: form });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "visualPriority", snapshot: form } });
    dispatch({ type: "ADVANCE_NODE" });
  }

  function handleSkip() {
    dispatch({ type: "SET_VISUAL_PRIORITY_DATA", payload: form });
    dispatch({ type: "SKIP_NODE", payload: "visualPriority" });
  }

  const isSkipped = session?.skippedNodes.includes("visualPriority");

  return (
    <NodeShell
      number="02"
      title="Visual Priority Locator"
      description="Identify which space or moment in your project best embodies your concept. Define what deserves to be visualized and why."
      icon={<Eye className="w-5 h-5 text-warm" />}
      totalFields={5}
      completedFields={filledCount}
      onSkip={handleSkip}
      skipped={isSkipped}
    >
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-warm/[0.04] border border-warm/10">
          <p className="text-[12px] text-foreground/80 leading-relaxed italic">
            &ldquo;Which space or moment best embodies your concept?&rdquo;
          </p>
        </div>

        <ChallengeCard
          label="Primary Focus Area"
          hint="The most important space or moment to visualize. This is where the viewer's eye should go first."
          filled={form.primaryFocusArea.trim().length >= 10}
          errors={errors.primaryFocusArea}
        >
          <Textarea
            value={form.primaryFocusArea}
            onChange={(e) => update("primaryFocusArea", e.target.value)}
            placeholder="e.g. The threshold between the compressed entry corridor and the double-height living volume"
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
          />
        </ChallengeCard>

        <ChallengeCard
          label="Secondary Focus Area"
          hint="What else supports or contextualizes the primary focus?"
          filled={form.secondaryFocusArea.trim().length >= 5}
        >
          <Textarea
            value={form.secondaryFocusArea}
            onChange={(e) => update("secondaryFocusArea", e.target.value)}
            placeholder="e.g. The stone fireplace wall that anchors the far end of the living volume"
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
          />
        </ChallengeCard>

        <ChallengeCard
          label="Sequence or Threshold"
          hint="Is there a spatial sequence, threshold, or transition worth capturing?"
          filled={form.sequenceThreshold.trim().length >= 5}
        >
          <Textarea
            value={form.sequenceThreshold}
            onChange={(e) => update("sequenceThreshold", e.target.value)}
            placeholder="e.g. The moment of spatial release when moving from the low entry to the open volume"
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
          />
        </ChallengeCard>

        <ChallengeCard
          label="Annotated Sketch"
          hint="Draw your plan or a diagram on paper. Mark your primary focus, secondary focus, and any sequences/thresholds. Upload a photo."
          filled={!!form.sketchBase64}
        >
          {form.sketchBase64 ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/jpeg;base64,${form.sketchBase64}`} alt="Priority sketch" className="w-full h-auto max-h-[200px] object-contain bg-foreground/[0.02]" />
              </div>
              <button
                onClick={() => setForm((p) => ({ ...p, sketchBase64: null, sketchFeedback: null }))}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Remove sketch
              </button>
              {sketchLoading && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Evaluating sketch...
                </div>
              )}
              {form.sketchFeedback && (
                <div className="p-3 rounded-lg bg-warm/[0.04] border border-warm/10">
                  <p className="text-[11px] text-foreground/70 leading-relaxed">{form.sketchFeedback}</p>
                </div>
              )}
            </div>
          ) : (
            <UploadZone
              onFiles={handleSketchUpload}
              label="Upload annotated sketch"
              sublabel="Hand-drawn plan with marked focus areas"
              icon={<div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center"><Upload className="w-4 h-4 text-muted-foreground/60" /></div>}
            />
          )}
        </ChallengeCard>

        <div className="h-px bg-foreground/[0.06] my-2" />

        <ChallengeCard
          label="Visualization Target"
          hint="Synthesize the above into a clear statement: what is the visualization target object for this project?"
          filled={form.visualizationTarget.trim().length >= 10}
          errors={errors.visualizationTarget}
        >
          <Textarea
            value={form.visualizationTarget}
            onChange={(e) => update("visualizationTarget", e.target.value)}
            placeholder="e.g. The moment of spatial release at the threshold between compressed entry and double-height living volume, viewed from within the corridor looking outward"
            className="min-h-[72px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            rows={4}
          />
        </ChallengeCard>
      </div>

      <div className="pt-4">
        <Button
          onClick={handleSubmit}
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all"
        >
          Save & Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </NodeShell>
  );
}

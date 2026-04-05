"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Box, ArrowRight, AlertTriangle, Check } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useApp, getActiveSession, type GeometryValidationData } from "@/lib/store";
import { validateTextField } from "@/lib/validation";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell, ChallengeCard } from "@/components/node-shell";
import { cn } from "@/lib/utils";

const emptyGeometry: GeometryValidationData = {
  cameraRelationship: "",
  cameraJustification: "",
  validated: false,
};

type FieldErrors = Partial<Record<keyof GeometryValidationData | "model", string[]>>;

export function GeometryValidation() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [form, setForm] = useState<GeometryValidationData>(session?.geometryValidation ?? emptyGeometry);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (session?.geometryValidation) setForm(session.geometryValidation);
  }, [session?.geometryValidation]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (state.modelImage) count++;
    if (form.cameraRelationship) count++;
    if (form.cameraJustification.trim().length >= 10) count++;
    return count;
  }, [form, state.modelImage]);

  const handleModelFiles = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (state.modelImage) URL.revokeObjectURL(state.modelImage.preview);
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    dispatch({ type: "SET_MODEL_IMAGE", payload: { id, file, preview, base64: null, mimeType: null, processing: false } });
  }, [state.modelImage, dispatch]);

  const handleRemoveModel = useCallback(() => {
    if (state.modelImage) URL.revokeObjectURL(state.modelImage.preview);
    dispatch({ type: "SET_MODEL_IMAGE", payload: null });
  }, [state.modelImage, dispatch]);

  const referenceTraits = useMemo(() => {
    if (!session?.referenceBreakdowns.length) return null;
    return session.referenceBreakdowns.map((r, i) => ({
      index: i + 1,
      borrowing: r.borrowingCategories,
      lens: r.lens,
      framing: r.framing,
    }));
  }, [session?.referenceBreakdowns]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!state.modelImage) e.model = ["Model screenshot is required."];
    if (!form.cameraRelationship) e.cameraRelationship = ["Select whether your view is similar or different from reference."];
    const justErrs = validateTextField(form.cameraJustification, "Camera justification", 10);
    if (justErrs.length > 0) e.cameraJustification = justErrs;
    return e;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const validated = { ...form, validated: true };
    dispatch({ type: "SET_GEOMETRY_VALIDATION", payload: validated });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "geometry", snapshot: validated } });
    dispatch({ type: "ADVANCE_NODE" });
  }

  function handleSkip() {
    dispatch({ type: "SET_GEOMETRY_VALIDATION", payload: form });
    dispatch({ type: "SKIP_NODE", payload: "geometry" });
  }

  const isSkipped = session?.skippedNodes.includes("geometry");

  return (
    <NodeShell
      number="04"
      title="Geometry & View Validation"
      description="Upload your 3D model and validate the camera view against your references. Once confirmed, this geometry guides all subsequent visualization decisions."
      icon={<Box className="w-5 h-5 text-warm" />}
      totalFields={3}
      completedFields={filledCount}
      onSkip={handleSkip}
      skipped={isSkipped}
    >
      {/* Geometry lock messaging */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/[0.08]">
        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Once validated, this geometry and perspective will guide all subsequent visualization decisions. Choose your camera angle deliberately.
        </p>
      </div>

      {/* Model upload */}
      <ChallengeCard
        label="Model Screenshot"
        hint="Upload your Rhino model screenshot. This defines the spatial layout and camera angle."
        filled={!!state.modelImage}
        errors={errors.model}
      >
        {state.modelImage ? (
          <AnimatePresence mode="wait">
            <ImageThumbnail key={state.modelImage.id} src={state.modelImage.preview} alt="3D Model Screenshot" uploading={state.modelImage.processing} onRemove={handleRemoveModel} aspectRatio="aspect-[4/3]" />
          </AnimatePresence>
        ) : (
          <UploadZone onFiles={handleModelFiles} label="Rhino screenshot" sublabel="Drop or click to upload" icon={<div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center"><Box className="w-4 h-4 text-muted-foreground/60" /></div>} />
        )}
      </ChallengeCard>

      {/* Reference reminder */}
      {referenceTraits && state.modelImage && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-foreground/80">Reference Visual Traits</p>
          <p className="text-[10px] text-muted-foreground">Review your reference analysis alongside your model view.</p>
          {referenceTraits.map((ref) => (
            <div key={ref.index} className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] space-y-1">
              <p className="text-[11px] font-mono text-muted-foreground">Reference {ref.index}</p>
              {ref.lens && <p className="text-[11px] text-foreground/70"><span className="text-muted-foreground/60">Lens:</span> {ref.lens}</p>}
              {ref.framing && <p className="text-[11px] text-foreground/70"><span className="text-muted-foreground/60">Framing:</span> {ref.framing}</p>}
              {ref.borrowing.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ref.borrowing.map((cat) => (
                    <span key={cat} className="text-[9px] px-2 py-0.5 rounded-md bg-warm/10 text-warm">{cat}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Camera validation */}
      {state.modelImage && (
        <>
          <ChallengeCard
            label="Camera View Relationship"
            hint="Is your camera view intentionally similar or intentionally different from your reference?"
            filled={!!form.cameraRelationship}
            errors={errors.cameraRelationship}
          >
            <div className="flex gap-2">
              {(["similar", "different"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => { setForm((p) => ({ ...p, cameraRelationship: option })); if (errors.cameraRelationship) setErrors((p) => ({ ...p, cameraRelationship: undefined })); }}
                  className={cn(
                    "flex-1 text-left px-3 py-2.5 rounded-lg border transition-all duration-200",
                    form.cameraRelationship === option
                      ? "border-warm/40 bg-warm/[0.08]"
                      : "border-foreground/[0.07] hover:border-foreground/[0.15]"
                  )}
                >
                  <p className={cn("text-[12px] font-medium capitalize", form.cameraRelationship === option ? "text-warm" : "text-foreground/80")}>
                    {option === "similar" ? "Intentionally Similar" : "Intentionally Different"}
                  </p>
                </button>
              ))}
            </div>
          </ChallengeCard>

          <ChallengeCard
            label="Why?"
            hint="Justify your camera view choice relative to your reference."
            filled={form.cameraJustification.trim().length >= 10}
            errors={errors.cameraJustification}
          >
            <Textarea
              value={form.cameraJustification}
              onChange={(e) => { setForm((p) => ({ ...p, cameraJustification: e.target.value })); if (errors.cameraJustification) setErrors((p) => ({ ...p, cameraJustification: undefined })); }}
              placeholder="e.g. I'm using a similar low eye-level to the reference because it emphasizes the spatial compression at the entry threshold"
              className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            />
          </ChallengeCard>
        </>
      )}

      {form.validated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warm/[0.06] border border-warm/20">
          <Check className="w-3.5 h-3.5 text-warm" />
          <span className="text-[11px] text-warm font-mono tracking-wider uppercase">
            Geometry validated
          </span>
        </div>
      )}

      <div className="pt-4">
        <Button
          onClick={handleSubmit}
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all"
        >
          Validate & Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </NodeShell>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { Palette, ArrowRight, Plus, Trash2, Check, CircleDot } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, getActiveSession, type MaterialJustification } from "@/lib/store";
import { validateTextField } from "@/lib/validation";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell } from "@/components/node-shell";
import { cn } from "@/lib/utils";

const MAX_MATERIALS = 4;

function createEmptyJustification(): MaterialJustification {
  return {
    id: crypto.randomUUID(),
    materialName: "",
    whyForUser: "",
    tactileQuality: "",
    lightBehavior: "",
    culturalCoherence: "",
    conceptReinforcement: "",
  };
}

type JustificationErrors = Partial<Record<keyof MaterialJustification, string[]>>;

function JustField({
  label,
  value,
  onChange,
  errors,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  errors?: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const filled = value.trim().length >= 10;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-3 h-3 rounded-full flex items-center justify-center shrink-0",
          filled ? "bg-warm/20" : "bg-foreground/[0.04]"
        )}>
          {filled ? (
            <Check className="w-2 h-2 text-warm" strokeWidth={3} />
          ) : (
            <CircleDot className="w-2 h-2 text-muted-foreground/30" />
          )}
        </div>
        <label className="block text-[11px] font-medium text-foreground/80">
          {label}
        </label>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40"
        disabled={disabled}
      />
      {errors?.map((e, i) => (
        <p key={i} className="text-[11px] text-destructive pl-5">
          {e}
        </p>
      ))}
    </div>
  );
}

function countJustificationFields(j: MaterialJustification): number {
  let count = 0;
  if (j.materialName.trim()) count++;
  if (j.whyForUser.trim().length >= 10) count++;
  if (j.tactileQuality.trim().length >= 10) count++;
  if (j.lightBehavior.trim().length >= 10) count++;
  if (j.culturalCoherence.trim().length >= 10) count++;
  if (j.conceptReinforcement.trim().length >= 10) count++;
  return count;
}

export function MaterialLogic() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isLocked = session ? session.currentNode !== "materials" : false;

  const [justifications, setJustifications] = useState<MaterialJustification[]>(
    session?.materialJustifications?.length ? session.materialJustifications : [createEmptyJustification()]
  );
  const [errors, setErrors] = useState<Record<string, JustificationErrors>>({});

  useEffect(() => {
    if (session?.materialJustifications?.length) {
      setJustifications(session.materialJustifications);
    }
  }, [session?.materialJustifications]);

  const totalCompleted = useMemo(() => {
    return justifications.reduce((sum, j) => sum + countJustificationFields(j), 0);
  }, [justifications]);
  const totalFields = justifications.length * 6;

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (state.materialImages.length >= MAX_MATERIALS) return;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      dispatch({
        type: "ADD_MATERIAL_IMAGE",
        payload: { id, file, preview, base64: null, mimeType: null, processing: false },
      });
    });
  };

  const handleRemoveImage = (id: string) => {
    const img = state.materialImages.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    dispatch({ type: "REMOVE_MATERIAL_IMAGE", payload: id });
  };

  function updateJustification(id: string, field: keyof MaterialJustification, value: string) {
    setJustifications((prev) =>
      prev.map((j) => (j.id === id ? { ...j, [field]: value } : j))
    );
    if (errors[id]?.[field]) {
      setErrors((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: undefined },
      }));
    }
  }

  function addJustification() {
    if (justifications.length >= MAX_MATERIALS) return;
    setJustifications((prev) => [...prev, createEmptyJustification()]);
  }

  function removeJustification(id: string) {
    setJustifications((prev) => prev.filter((j) => j.id !== id));
  }

  function validate(): Record<string, JustificationErrors> {
    const allErrors: Record<string, JustificationErrors> = {};
    for (const j of justifications) {
      const e: JustificationErrors = {};
      const nameErr = j.materialName.trim() ? [] : ["Material name is required."];
      if (nameErr.length) e.materialName = nameErr;
      e.whyForUser = validateTextField(j.whyForUser, "Justification", 30);
      e.tactileQuality = validateTextField(j.tactileQuality, "Tactile quality", 20);
      e.lightBehavior = validateTextField(j.lightBehavior, "Light behavior", 20);
      e.culturalCoherence = validateTextField(j.culturalCoherence, "Cultural coherence", 20);
      e.conceptReinforcement = validateTextField(j.conceptReinforcement, "Concept reinforcement", 20);

      const cleaned: JustificationErrors = {};
      for (const [k, v] of Object.entries(e)) {
        if (v && v.length > 0) cleaned[k as keyof MaterialJustification] = v;
      }
      if (Object.keys(cleaned).length > 0) allErrors[j.id] = cleaned;
    }
    return allErrors;
  }

  function handleSubmit() {
    if (isLocked) return;
    if (justifications.length === 0) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    dispatch({ type: "SET_MATERIAL_JUSTIFICATIONS", payload: justifications });
    dispatch({ type: "ADVANCE_NODE" });
  }

  return (
    <NodeShell
      number="02"
      title="Material Logic"
      description="Justify every material choice. No aesthetic-only answers — connect each material to the user, the concept, and the light."
      icon={<Palette className="w-5 h-5 text-warm" />}
      totalFields={totalFields}
      completedFields={totalCompleted}
      locked={isLocked}
    >
      {/* Material images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-foreground/80">
            Material References
          </span>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {state.materialImages.length}/{MAX_MATERIALS}
          </span>
        </div>

        {state.materialImages.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <AnimatePresence>
              {state.materialImages.map((img) => (
                <ImageThumbnail
                  key={img.id}
                  src={img.preview}
                  alt="Material"
                  uploading={img.processing}
                  onRemove={isLocked ? undefined : () => handleRemoveImage(img.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isLocked && state.materialImages.length < MAX_MATERIALS && (
          <UploadZone
            onFiles={handleFiles}
            multiple
            maxFiles={MAX_MATERIALS}
            currentCount={state.materialImages.length}
            compact={state.materialImages.length > 0}
            label={state.materialImages.length > 0 ? "Add material" : "Material references"}
            sublabel={state.materialImages.length === 0 ? "Textures, finishes, samples" : undefined}
          />
        )}
      </div>

      {/* Justification cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-foreground/80">
            Material Justifications
          </span>
          {!isLocked && justifications.length < MAX_MATERIALS && (
            <button
              onClick={addJustification}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )}
        </div>

        <AnimatePresence>
          {justifications.map((j, idx) => {
            const jFilled = countJustificationFields(j);
            return (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "rounded-xl border p-4 space-y-3 transition-all",
                  jFilled === 6
                    ? "border-warm/20 bg-warm/[0.02]"
                    : "border-foreground/[0.07] bg-foreground/[0.01]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Material {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
                      {jFilled}/6
                    </span>
                  </div>
                  {!isLocked && justifications.length > 1 && (
                    <button
                      onClick={() => removeJustification(j.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full flex items-center justify-center shrink-0",
                      j.materialName.trim() ? "bg-warm/20" : "bg-foreground/[0.04]"
                    )}>
                      {j.materialName.trim() ? (
                        <Check className="w-2 h-2 text-warm" strokeWidth={3} />
                      ) : (
                        <CircleDot className="w-2 h-2 text-muted-foreground/30" />
                      )}
                    </div>
                    <label className="block text-[11px] font-medium text-foreground/80">
                      Material Name
                    </label>
                  </div>
                  <input
                    type="text"
                    value={j.materialName}
                    onChange={(e) => updateJustification(j.id, "materialName", e.target.value)}
                    placeholder="e.g. Honed Travertine, White Oak Veneer"
                    className="w-full h-8 px-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isLocked}
                  />
                  {errors[j.id]?.materialName?.map((e, i) => (
                    <p key={i} className="text-[11px] text-destructive pl-5">{e}</p>
                  ))}
                </div>

                <JustField label="Why this material for this user?" value={j.whyForUser} onChange={(v) => updateJustification(j.id, "whyForUser", v)} errors={errors[j.id]?.whyForUser} disabled={isLocked} placeholder="Connect the material to the declared target user and their values" />
                <JustField label="Tactile Quality" value={j.tactileQuality} onChange={(v) => updateJustification(j.id, "tactileQuality", v)} errors={errors[j.id]?.tactileQuality} disabled={isLocked} placeholder="How does this material feel? Rough, polished, warm, cool?" />
                <JustField label="Light Behavior" value={j.lightBehavior} onChange={(v) => updateJustification(j.id, "lightBehavior", v)} errors={errors[j.id]?.lightBehavior} disabled={isLocked} placeholder="How does this material respond to light?" />
                <JustField label="Cultural Coherence" value={j.culturalCoherence} onChange={(v) => updateJustification(j.id, "culturalCoherence", v)} errors={errors[j.id]?.culturalCoherence} disabled={isLocked} placeholder="Is this material culturally appropriate for the context?" />
                <JustField label="Concept Reinforcement" value={j.conceptReinforcement} onChange={(v) => updateJustification(j.id, "conceptReinforcement", v)} errors={errors[j.id]?.conceptReinforcement} disabled={isLocked} placeholder="How does this material reinforce the design concept?" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {!isLocked && (
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            disabled={justifications.length === 0}
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20"
          >
            Lock Materials
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

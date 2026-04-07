"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Palette, Sun, ArrowRight, Plus, Trash2, Check, CircleDot, AlertTriangle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, getActiveSession, type MaterialJustification, type LightingData } from "@/lib/store";
import { validateTextField, validateRequired } from "@/lib/validation";
import { checkMaterialLightInteraction } from "@/lib/ai-advisory";
import { UploadZone } from "./upload-zone";
import { ImageThumbnail } from "./image-thumbnail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeShell, ChallengeCard } from "@/components/node-shell";
import { cn } from "@/lib/utils";

const MAX_MATERIALS = 4;

const PRESETS: { value: LightingData["preset"]; label: string; description: string }[] = [
  { value: "overcast", label: "Overcast Softness", description: "Diffused, even illumination with minimal shadows" },
  { value: "golden-hour", label: "Golden Hour Warmth", description: "Warm directional light with long, soft shadows" },
  { value: "high-contrast", label: "High-Contrast Directional", description: "Sharp shadows, dramatic depth, strong focal hierarchy" },
  { value: "flat-documentary", label: "Flat Documentary", description: "Neutral, informational light — minimal atmosphere" },
  { value: "custom", label: "Custom", description: "Define your own lighting logic" },
];

const TIME_OPTIONS = ["Early morning (6-8am)", "Morning (8-10am)", "Midday (10am-2pm)", "Afternoon (2-5pm)", "Golden hour (5-7pm)", "Dusk (7-8pm)", "Night"];

function createEmptyJustification(): MaterialJustification {
  return { id: crypto.randomUUID(), materialName: "", whyForUser: "", tactileQuality: "", lightBehavior: "", culturalCoherence: "", conceptReinforcement: "", zone: "" };
}

const emptyLighting: LightingData = { timeOfDay: "", lightSource: "", contrastLevel: "", shadowIntention: "", moodProduced: "", preset: "" };

type MaterialErrors = Record<string, Partial<Record<keyof MaterialJustification, string[]>>>;
type LightingErrors = Partial<Record<keyof LightingData, string[]>>;

function JustField({ label, value, onChange, errors, placeholder }: { label: string; value: string; onChange: (v: string) => void; errors?: string[]; placeholder?: string }) {
  const filled = value.trim().length >= 10;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={cn("w-3 h-3 rounded-full flex items-center justify-center shrink-0", filled ? "bg-warm/20" : "bg-foreground/[0.04]")}>
          {filled ? <Check className="w-2 h-2 text-warm" strokeWidth={3} /> : <CircleDot className="w-2 h-2 text-muted-foreground/30" />}
        </div>
        <label className="block text-[11px] font-medium text-foreground/80">{label}</label>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" />
      {errors?.map((e, i) => <p key={i} className="text-[11px] text-destructive pl-5">{e}</p>)}
    </div>
  );
}

export function MaterialsLightValidation() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [justifications, setJustifications] = useState<MaterialJustification[]>(
    session?.materialJustifications?.length ? session.materialJustifications : [createEmptyJustification()]
  );
  const [lighting, setLighting] = useState<LightingData>(session?.lighting ?? emptyLighting);
  const [matErrors, setMatErrors] = useState<MaterialErrors>({});
  const [litErrors, setLitErrors] = useState<LightingErrors>({});
  const [interactionFlags, setInteractionFlags] = useState<string[]>([]);
  const [checkingInteraction, setCheckingInteraction] = useState(false);

  useEffect(() => {
    if (session?.materialJustifications?.length) setJustifications(session.materialJustifications);
    if (session?.lighting) setLighting(session.lighting);
  }, [session?.materialJustifications, session?.lighting]);

  const matFilledCount = useMemo(() => {
    return justifications.reduce((sum, j) => {
      let c = 0;
      if (j.materialName.trim()) c++;
      if (j.whyForUser.trim().length >= 10) c++;
      if (j.tactileQuality.trim().length >= 10) c++;
      if (j.lightBehavior.trim().length >= 10) c++;
      if (j.zone.trim().length >= 5) c++;
      return sum + c;
    }, 0);
  }, [justifications]);

  const litFilledCount = useMemo(() => {
    let c = 0;
    if (lighting.preset) c++;
    if (lighting.timeOfDay) c++;
    if (lighting.lightSource) c++;
    if (lighting.contrastLevel.trim().length >= 10) c++;
    if (lighting.shadowIntention.trim().length >= 10) c++;
    if (lighting.moodProduced.trim().length >= 10) c++;
    return c;
  }, [lighting]);

  const totalFields = justifications.length * 5 + 6;
  const totalFilled = matFilledCount + litFilledCount;

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      if (state.materialImages.length >= MAX_MATERIALS) return;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      dispatch({ type: "ADD_MATERIAL_IMAGE", payload: { id, file, preview, base64: null, mimeType: null, processing: false } });
    });
  };

  const handleRemoveImage = (id: string) => {
    const img = state.materialImages.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    dispatch({ type: "REMOVE_MATERIAL_IMAGE", payload: id });
  };

  function updateJustification(id: string, field: keyof MaterialJustification, value: string) {
    setJustifications((prev) => prev.map((j) => j.id === id ? { ...j, [field]: value } : j));
    if (matErrors[id]?.[field]) setMatErrors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: undefined } }));
  }

  function addJustification() {
    if (justifications.length >= MAX_MATERIALS) return;
    setJustifications((prev) => [...prev, createEmptyJustification()]);
  }

  function removeJustification(id: string) {
    setJustifications((prev) => prev.filter((j) => j.id !== id));
  }

  function updateLighting<K extends keyof LightingData>(field: K, value: LightingData[K]) {
    setLighting((prev) => ({ ...prev, [field]: value }));
    if (litErrors[field]) setLitErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function selectPreset(preset: LightingData["preset"]) {
    updateLighting("preset", preset);
    if (preset === "overcast") setLighting((prev) => ({ ...prev, preset, contrastLevel: "Low — soft gradients with minimal tonal separation", shadowIntention: "Diffused, nearly absent shadows creating an even, contemplative atmosphere" }));
    else if (preset === "golden-hour") setLighting((prev) => ({ ...prev, preset, contrastLevel: "Medium — warm highlights against cool shadow areas", shadowIntention: "Long directional shadows that add depth and warmth to the composition" }));
    else if (preset === "high-contrast") setLighting((prev) => ({ ...prev, preset, contrastLevel: "High — strong tonal separation between light and shadow", shadowIntention: "Sharp, defined shadows creating dramatic spatial hierarchy" }));
    else if (preset === "flat-documentary") setLighting((prev) => ({ ...prev, preset, contrastLevel: "Minimal — flat, even illumination for objective documentation", shadowIntention: "Neutral shadows, not styled or dramatized" }));
  }

  const runInteractionCheck = useCallback(async () => {
    if (justifications.length === 0 || !lighting.lightSource) return;
    setCheckingInteraction(true);
    try {
      const flags = await checkMaterialLightInteraction(justifications, lighting);
      setInteractionFlags(flags);
    } catch {
      setInteractionFlags([]);
    } finally {
      setCheckingInteraction(false);
    }
  }, [justifications, lighting]);

  function validate(): { mat: MaterialErrors; lit: LightingErrors } {
    const mat: MaterialErrors = {};
    for (const j of justifications) {
      const e: Partial<Record<keyof MaterialJustification, string[]>> = {};
      if (!j.materialName.trim()) e.materialName = ["Material name is required."];
      e.whyForUser = validateTextField(j.whyForUser, "Justification", 10);
      e.tactileQuality = validateTextField(j.tactileQuality, "Tactile quality", 10);
      e.lightBehavior = validateTextField(j.lightBehavior, "Light behavior", 10);
      const cleaned: Partial<Record<keyof MaterialJustification, string[]>> = {};
      for (const [k, v] of Object.entries(e)) { if (v && v.length > 0) cleaned[k as keyof MaterialJustification] = v; }
      if (Object.keys(cleaned).length > 0) mat[j.id] = cleaned;
    }

    const lit: LightingErrors = {};
    const timeReq = validateRequired(lighting.timeOfDay, "Time of day");
    if (timeReq) lit.timeOfDay = [timeReq];
    const srcReq = validateRequired(lighting.lightSource, "Light source");
    if (srcReq) lit.lightSource = [srcReq];
    const contErrs = validateTextField(lighting.contrastLevel, "Contrast level", 10);
    if (contErrs.length > 0) lit.contrastLevel = contErrs;
    const shadErrs = validateTextField(lighting.shadowIntention, "Shadow intention", 10);
    if (shadErrs.length > 0) lit.shadowIntention = shadErrs;
    const moodErrs = validateTextField(lighting.moodProduced, "Mood produced", 10);
    if (moodErrs.length > 0) lit.moodProduced = moodErrs;

    return { mat, lit };
  }

  function handleSubmit() {
    if (justifications.length === 0) return;
    const { mat, lit } = validate();
    if (Object.keys(mat).length > 0 || Object.keys(lit).length > 0) {
      setMatErrors(mat);
      setLitErrors(lit);
      return;
    }
    dispatch({ type: "SET_MATERIAL_JUSTIFICATIONS", payload: justifications });
    dispatch({ type: "SET_LIGHTING_DATA", payload: lighting });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "materialsLight", snapshot: { justifications, lighting } } });
    dispatch({ type: "ADVANCE_NODE" });
    runInteractionCheck();
  }

  function handleSkip() {
    dispatch({ type: "SET_MATERIAL_JUSTIFICATIONS", payload: justifications });
    dispatch({ type: "SET_LIGHTING_DATA", payload: lighting });
    dispatch({ type: "SKIP_NODE", payload: "materialsLight" });
  }

  const isSkipped = session?.skippedNodes.includes("materialsLight");

  return (
    <NodeShell
      number="05"
      title="Material & Light Validation"
      description="Justify every material choice and define your lighting logic. Connect each decision to the user, the concept, and the spatial intent."
      icon={<Palette className="w-5 h-5 text-warm" />}
      totalFields={totalFields}
      completedFields={totalFilled}
      onSkip={handleSkip}
      skipped={isSkipped}
    >
      {/* ===== MATERIALS SECTION ===== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[12px] font-medium text-foreground/90">Materials</span>
        </div>

        {/* Material images */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted-foreground">Material References</span>
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{state.materialImages.length}/{MAX_MATERIALS}</span>
          </div>
          {state.materialImages.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <AnimatePresence>
                {state.materialImages.map((img) => (
                  <ImageThumbnail key={img.id} src={img.preview} alt="Material" uploading={img.processing} onRemove={() => handleRemoveImage(img.id)} />
                ))}
              </AnimatePresence>
            </div>
          )}
          {state.materialImages.length < MAX_MATERIALS && (
            <UploadZone onFiles={handleFiles} multiple maxFiles={MAX_MATERIALS} currentCount={state.materialImages.length} compact={state.materialImages.length > 0} label={state.materialImages.length > 0 ? "Add material" : "Material references"} sublabel={state.materialImages.length === 0 ? "Textures, finishes, samples" : undefined} />
          )}
        </div>

        {/* Justification cards */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Material Justifications</span>
          {justifications.length < MAX_MATERIALS && (
            <button onClick={addJustification} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"><Plus className="w-3 h-3" /> Add</button>
          )}
        </div>

        <AnimatePresence>
          {justifications.map((j, idx) => {
            const jFilled = [j.materialName.trim(), j.whyForUser.trim().length >= 10, j.tactileQuality.trim().length >= 10, j.lightBehavior.trim().length >= 10, j.zone.trim().length >= 5].filter(Boolean).length;
            return (
              <motion.div key={j.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className={cn("rounded-xl border p-4 space-y-3 transition-all", jFilled === 5 ? "border-warm/20 bg-warm/[0.02]" : "border-foreground/[0.07] bg-foreground/[0.01]")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">Material {idx + 1}</span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{jFilled}/5</span>
                  </div>
                  {justifications.length > 1 && (
                    <button onClick={() => removeJustification(j.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full flex items-center justify-center shrink-0", j.materialName.trim() ? "bg-warm/20" : "bg-foreground/[0.04]")}>
                      {j.materialName.trim() ? <Check className="w-2 h-2 text-warm" strokeWidth={3} /> : <CircleDot className="w-2 h-2 text-muted-foreground/30" />}
                    </div>
                    <label className="block text-[11px] font-medium text-foreground/80">Material Name</label>
                  </div>
                  <input type="text" value={j.materialName} onChange={(e) => updateJustification(j.id, "materialName", e.target.value)} placeholder="e.g. Honed Travertine, White Oak Veneer" className="w-full h-8 px-3 rounded-md bg-transparent border border-border text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring" />
                  {matErrors[j.id]?.materialName?.map((e, i) => <p key={i} className="text-[11px] text-destructive pl-5">{e}</p>)}
                </div>

                <JustField label="Why this material for this user?" value={j.whyForUser} onChange={(v) => updateJustification(j.id, "whyForUser", v)} errors={matErrors[j.id]?.whyForUser} placeholder="Connect the material to the declared target user and their values" />
                <JustField label="Tactile Quality" value={j.tactileQuality} onChange={(v) => updateJustification(j.id, "tactileQuality", v)} errors={matErrors[j.id]?.tactileQuality} placeholder="How does this material feel? Rough, polished, warm, cool?" />
                <JustField label="Light Behavior" value={j.lightBehavior} onChange={(v) => updateJustification(j.id, "lightBehavior", v)} errors={matErrors[j.id]?.lightBehavior} placeholder="How does this material respond to light?" />

                <JustField label="Zone" value={j.zone} onChange={(v) => updateJustification(j.id, "zone", v)} placeholder="Which part of the model does this apply to? e.g. North wall, floor plane, ceiling" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="h-px bg-foreground/[0.06] my-4" />

      {/* ===== LIGHTING SECTION ===== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sun className="w-3.5 h-3.5 text-warm/70" />
          <span className="text-[12px] font-medium text-foreground/90">Lighting</span>
        </div>

        <ChallengeCard label="Lighting Preset" hint="Choose a starting point, or go custom." filled={!!lighting.preset}>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.value} onClick={() => selectPreset(p.value)}
                className={cn("text-left px-3 py-2.5 rounded-lg border transition-all duration-200",
                  lighting.preset === p.value ? "border-warm/40 bg-warm/[0.08]" : "border-foreground/[0.07] hover:border-foreground/[0.15]")}>
                <p className={cn("text-[12px] font-medium", lighting.preset === p.value ? "text-warm" : "text-foreground/80")}>{p.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </ChallengeCard>

        <ChallengeCard label="Time of Day" filled={!!lighting.timeOfDay} errors={litErrors.timeOfDay}>
          <Select value={lighting.timeOfDay} onValueChange={(v) => v && updateLighting("timeOfDay", v)}>
            <SelectTrigger className="h-9 bg-transparent border-border text-[13px]"><SelectValue placeholder="Select time of day..." /></SelectTrigger>
            <SelectContent>{TIME_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
          </Select>
        </ChallengeCard>

        <ChallengeCard label="Light Source" filled={!!lighting.lightSource} errors={litErrors.lightSource}>
          <Select value={lighting.lightSource} onValueChange={(v) => v && updateLighting("lightSource", v as LightingData["lightSource"])}>
            <SelectTrigger className="h-9 bg-transparent border-border text-[13px]"><SelectValue placeholder="Select light source..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">Natural</SelectItem>
              <SelectItem value="artificial">Artificial</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </ChallengeCard>

        <ChallengeCard label="Contrast Level" hint="Describe the tonal relationship between light and shadow." filled={lighting.contrastLevel.trim().length >= 10} errors={litErrors.contrastLevel}>
          <Textarea value={lighting.contrastLevel} onChange={(e) => updateLighting("contrastLevel", e.target.value)} placeholder="e.g. Medium contrast — warm tones in highlights, cool receding shadows" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" />
        </ChallengeCard>

        <ChallengeCard label="Shadow Intention" hint="What role do shadows play in this image?" filled={lighting.shadowIntention.trim().length >= 10} errors={litErrors.shadowIntention}>
          <Textarea value={lighting.shadowIntention} onChange={(e) => updateLighting("shadowIntention", e.target.value)} placeholder="e.g. Soft ambient shadows grounding furniture, with sharper shadows under cantilevered elements" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" />
        </ChallengeCard>

        <ChallengeCard label="Mood Produced" hint="What feeling does this lighting produce?" filled={lighting.moodProduced.trim().length >= 10} errors={litErrors.moodProduced}>
          <Textarea value={lighting.moodProduced} onChange={(e) => updateLighting("moodProduced", e.target.value)} placeholder="e.g. A sense of late-afternoon stillness where light reveals material grain and spatial depth" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" />
        </ChallengeCard>
      </div>

      {/* Material-Light Interaction Flags */}
      {interactionFlags.length > 0 && (
        <div className="space-y-2 mt-4">
          {interactionFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">{flag}</p>
            </div>
          ))}
        </div>
      )}

      {checkingInteraction && (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking material-light interactions...
        </div>
      )}

      <div className="pt-4">
        <Button onClick={handleSubmit} disabled={justifications.length === 0} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all disabled:opacity-20">
          Save & Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </NodeShell>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { Sun, ArrowRight } from "lucide-react";
import { useApp, getActiveSession, type LightingData } from "@/lib/store";
import { validateTextField, validateRequired } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NodeShell, ChallengeCard } from "@/components/node-shell";

const PRESETS: { value: LightingData["preset"]; label: string; description: string }[] = [
  { value: "overcast", label: "Overcast Softness", description: "Diffused, even illumination with minimal shadows" },
  { value: "golden-hour", label: "Golden Hour Warmth", description: "Warm directional light with long, soft shadows" },
  { value: "high-contrast", label: "High-Contrast Directional", description: "Sharp shadows, dramatic depth, strong focal hierarchy" },
  { value: "flat-documentary", label: "Flat Documentary", description: "Neutral, informational light -- minimal atmosphere" },
  { value: "custom", label: "Custom", description: "Define your own lighting logic" },
];

const TIME_OPTIONS = [
  "Early morning (6-8am)",
  "Morning (8-10am)",
  "Midday (10am-2pm)",
  "Afternoon (2-5pm)",
  "Golden hour (5-7pm)",
  "Dusk (7-8pm)",
  "Night",
];

const emptyLighting: LightingData = {
  timeOfDay: "",
  lightSource: "",
  contrastLevel: "",
  shadowIntention: "",
  moodProduced: "",
  preset: "",
};

type FieldErrors = Partial<Record<keyof LightingData, string[]>>;

export function LightingForm() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isLocked = session ? session.currentNode !== "lighting" : false;

  const [form, setForm] = useState<LightingData>(session?.lighting ?? emptyLighting);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (session?.lighting) setForm(session.lighting);
  }, [session?.lighting]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (form.preset) count++;
    if (form.timeOfDay) count++;
    if (form.lightSource) count++;
    if (form.contrastLevel.trim().length >= 10) count++;
    if (form.shadowIntention.trim().length >= 10) count++;
    if (form.moodProduced.trim().length >= 10) count++;
    return count;
  }, [form]);

  function update<K extends keyof LightingData>(field: K, value: LightingData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function selectPreset(preset: LightingData["preset"]) {
    update("preset", preset);
    if (preset === "overcast") {
      setForm((prev) => ({ ...prev, preset, contrastLevel: "Low -- soft gradients with minimal tonal separation", shadowIntention: "Diffused, nearly absent shadows creating an even, contemplative atmosphere" }));
    } else if (preset === "golden-hour") {
      setForm((prev) => ({ ...prev, preset, contrastLevel: "Medium -- warm highlights against cool shadow areas", shadowIntention: "Long directional shadows that add depth and warmth to the composition" }));
    } else if (preset === "high-contrast") {
      setForm((prev) => ({ ...prev, preset, contrastLevel: "High -- strong tonal separation between light and shadow", shadowIntention: "Sharp, defined shadows creating dramatic spatial hierarchy" }));
    } else if (preset === "flat-documentary") {
      setForm((prev) => ({ ...prev, preset, contrastLevel: "Minimal -- flat, even illumination for objective documentation", shadowIntention: "Neutral shadows, not styled or dramatized" }));
    }
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const timeReq = validateRequired(form.timeOfDay, "Time of day");
    if (timeReq) e.timeOfDay = [timeReq];
    const srcReq = validateRequired(form.lightSource, "Light source");
    if (srcReq) e.lightSource = [srcReq];
    e.contrastLevel = validateTextField(form.contrastLevel, "Contrast level", 20);
    e.shadowIntention = validateTextField(form.shadowIntention, "Shadow intention", 20);
    e.moodProduced = validateTextField(form.moodProduced, "Mood produced", 30);

    const cleaned: FieldErrors = {};
    for (const [k, v] of Object.entries(e)) {
      if (v && v.length > 0) cleaned[k as keyof LightingData] = v;
    }
    return cleaned;
  }

  function handleSubmit() {
    if (isLocked) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    dispatch({ type: "SET_LIGHTING_DATA", payload: form });
    dispatch({ type: "ADVANCE_NODE" });
  }

  return (
    <NodeShell
      number="03"
      title="Light & Atmosphere"
      description="Control the atmosphere deliberately. Choose lighting that reinforces the emotional intent of the space."
      icon={<Sun className="w-5 h-5 text-warm" />}
      totalFields={6}
      completedFields={filledCount}
      locked={isLocked}
    >
      <div className="space-y-3">
        {/* Presets as selection cards */}
        <ChallengeCard
          label="Lighting Preset"
          hint="Choose a starting point, or go custom."
          filled={!!form.preset}
        >
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => !isLocked && selectPreset(p.value)}
                disabled={isLocked}
                className={cn(
                  "text-left px-3 py-2.5 rounded-lg border transition-all duration-200",
                  form.preset === p.value
                    ? "border-warm/40 bg-warm/[0.08]"
                    : "border-foreground/[0.07] hover:border-foreground/[0.15]",
                  isLocked && "opacity-60 cursor-not-allowed"
                )}
              >
                <p className={cn(
                  "text-[12px] font-medium",
                  form.preset === p.value ? "text-warm" : "text-foreground/80"
                )}>
                  {p.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </ChallengeCard>

        <ChallengeCard label="Time of Day" filled={!!form.timeOfDay} errors={errors.timeOfDay}>
          <Select value={form.timeOfDay} onValueChange={(v) => v && update("timeOfDay", v)} disabled={isLocked}>
            <SelectTrigger className="h-9 bg-transparent border-border text-[13px]">
              <SelectValue placeholder="Select time of day..." />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChallengeCard>

        <ChallengeCard label="Light Source" filled={!!form.lightSource} errors={errors.lightSource}>
          <Select value={form.lightSource} onValueChange={(v) => v && update("lightSource", v as LightingData["lightSource"])} disabled={isLocked}>
            <SelectTrigger className="h-9 bg-transparent border-border text-[13px]">
              <SelectValue placeholder="Select light source..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">Natural</SelectItem>
              <SelectItem value="artificial">Artificial</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </ChallengeCard>

        <ChallengeCard label="Contrast Level" hint="Describe the tonal relationship between light and shadow." filled={form.contrastLevel.trim().length >= 10} errors={errors.contrastLevel}>
          <Textarea value={form.contrastLevel} onChange={(e) => update("contrastLevel", e.target.value)} placeholder="e.g. Medium contrast -- warm tones in highlights, cool receding shadows" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isLocked} />
        </ChallengeCard>

        <ChallengeCard label="Shadow Intention" hint="What role do shadows play in this image?" filled={form.shadowIntention.trim().length >= 10} errors={errors.shadowIntention}>
          <Textarea value={form.shadowIntention} onChange={(e) => update("shadowIntention", e.target.value)} placeholder="e.g. Soft ambient shadows grounding furniture, with sharper shadows under cantilevered elements" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isLocked} />
        </ChallengeCard>

        <ChallengeCard label="Mood Produced" hint="What feeling does this lighting produce? Be specific." filled={form.moodProduced.trim().length >= 10} errors={errors.moodProduced}>
          <Textarea value={form.moodProduced} onChange={(e) => update("moodProduced", e.target.value)} placeholder="e.g. A sense of late-afternoon stillness where light reveals material grain and spatial depth" className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isLocked} />
        </ChallengeCard>
      </div>

      {!isLocked && (
        <div className="pt-4">
          <Button onClick={handleSubmit} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all">
            Lock Lighting
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

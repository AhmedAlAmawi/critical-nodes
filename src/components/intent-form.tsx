"use client";

import { useState, useEffect, useMemo } from "react";
import { Target, ArrowRight } from "lucide-react";
import { useApp, getActiveSession, type IntentData } from "@/lib/store";
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
import { NodeShell, ChallengeCard } from "@/components/node-shell";

const IMAGE_TYPE_OPTIONS = [
  { value: "documentary", label: "Documentary" },
  { value: "atmospheric", label: "Atmospheric" },
  { value: "material-focused", label: "Material-Focused" },
  { value: "narrative", label: "Narrative" },
];

const emptyIntent: IntentData = {
  conceptStatement: "",
  targetUser: "",
  spatialGoal: "",
  emotionalAtmosphere: "",
  behaviorReinforcement: "",
  imageType: "",
  intentStatement: "",
};

type FieldErrors = Partial<Record<keyof IntentData, string[]>>;

export function IntentForm() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isLocked = session ? session.currentNode !== "intent" : false;

  const [form, setForm] = useState<IntentData>(session?.intent ?? emptyIntent);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (session?.intent) setForm(session.intent);
  }, [session?.intent]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (form.conceptStatement.trim().length >= 10) count++;
    if (form.targetUser.trim().length >= 10) count++;
    if (form.spatialGoal.trim().length >= 10) count++;
    if (form.emotionalAtmosphere.trim().length >= 10) count++;
    if (form.behaviorReinforcement.trim().length >= 10) count++;
    if (form.imageType) count++;
    if (form.intentStatement.trim().length >= 20) count++;
    return count;
  }, [form]);

  function update<K extends keyof IntentData>(field: K, value: IntentData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    e.conceptStatement = validateTextField(form.conceptStatement, "Concept statement");
    e.targetUser = validateTextField(form.targetUser, "Target user");
    e.spatialGoal = validateTextField(form.spatialGoal, "Spatial goal");
    e.emotionalAtmosphere = validateTextField(form.emotionalAtmosphere, "Emotional atmosphere");
    e.behaviorReinforcement = validateTextField(form.behaviorReinforcement, "Behavior reinforcement");
    const imgReq = validateRequired(form.imageType, "Image type");
    e.imageType = imgReq ? [imgReq] : [];
    e.intentStatement = validateTextField(form.intentStatement, "Intent statement", 60);

    const cleaned: FieldErrors = {};
    for (const [k, v] of Object.entries(e)) {
      if (v && v.length > 0) cleaned[k as keyof IntentData] = v;
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
    dispatch({ type: "SET_INTENT_DATA", payload: form });
    dispatch({ type: "ADVANCE_NODE" });
  }

  return (
    <NodeShell
      number="01"
      title="Intent Definition"
      description="Define the foundational intent of this visualization. Every subsequent decision is validated against the intent created here."
      icon={<Target className="w-5 h-5 text-warm" />}
      totalFields={7}
      completedFields={filledCount}
      locked={isLocked}
    >
      <div className="space-y-3">
        <ChallengeCard
          label="Concept Statement"
          hint="Describe the typology, scale, and context of the project."
          filled={form.conceptStatement.trim().length >= 10}
          errors={errors.conceptStatement}
        >
          <Textarea
            value={form.conceptStatement}
            onChange={(e) => update("conceptStatement", e.target.value)}
            placeholder="e.g. Residential living room for a private client in an urban context with exposed structural elements"
            className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
          />
        </ChallengeCard>

        <ChallengeCard
          label="Target User"
          hint="Who inhabits or uses this space? Be demographic and behavioural."
          filled={form.targetUser.trim().length >= 10}
          errors={errors.targetUser}
        >
          <Textarea
            value={form.targetUser}
            onChange={(e) => update("targetUser", e.target.value)}
            placeholder="e.g. High-income professional couple, 35-50, values privacy and craft"
            className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
          />
        </ChallengeCard>

        <ChallengeCard
          label="Spatial Goal"
          hint="What spatial quality or experience must this space deliver?"
          filled={form.spatialGoal.trim().length >= 10}
          errors={errors.spatialGoal}
        >
          <Textarea
            value={form.spatialGoal}
            onChange={(e) => update("spatialGoal", e.target.value)}
            placeholder="e.g. A compressed entry that opens into a double-height living volume anchored by a stone fireplace wall"
            className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
          />
        </ChallengeCard>

        <ChallengeCard
          label="Emotional Atmosphere"
          hint="The specific emotional register this image must communicate."
          filled={form.emotionalAtmosphere.trim().length >= 10}
          errors={errors.emotionalAtmosphere}
        >
          <Textarea
            value={form.emotionalAtmosphere}
            onChange={(e) => update("emotionalAtmosphere", e.target.value)}
            placeholder="e.g. Quiet tension between exposed structure and soft materiality"
            className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
          />
        </ChallengeCard>

        <ChallengeCard
          label="Behavior Reinforcement"
          hint="What behaviors should this render reinforce?"
          filled={form.behaviorReinforcement.trim().length >= 10}
          errors={errors.behaviorReinforcement}
        >
          <Textarea
            value={form.behaviorReinforcement}
            onChange={(e) => update("behaviorReinforcement", e.target.value)}
            placeholder="e.g. Encourages slow contemplation, seated conversation, and tactile engagement with surfaces"
            className="min-h-[44px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
          />
        </ChallengeCard>

        <ChallengeCard
          label="Image Type"
          hint="Is this a documentary image or an atmospheric narrative?"
          filled={!!form.imageType}
          errors={errors.imageType}
        >
          <Select
            value={form.imageType}
            onValueChange={(v) => update("imageType", v as IntentData["imageType"])}
            disabled={isLocked}
          >
            <SelectTrigger className="h-9 bg-transparent border-border text-[13px]">
              <SelectValue placeholder="Select image type..." />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChallengeCard>

        <ChallengeCard
          label="Final Intent Statement"
          hint="A complete 3-line declaration. This becomes the reference anchor for all subsequent nodes."
          filled={form.intentStatement.trim().length >= 20}
          errors={errors.intentStatement}
        >
          <Textarea
            value={form.intentStatement}
            onChange={(e) => update("intentStatement", e.target.value)}
            placeholder="Write a 3-line statement of what this image is designed to communicate, to whom, and why this specific visual approach was chosen."
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isLocked}
            rows={4}
          />
        </ChallengeCard>
      </div>

      {!isLocked && (
        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all"
          >
            Lock Intent
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

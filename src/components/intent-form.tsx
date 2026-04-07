"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Target, ArrowRight, Loader2, Sparkles, Upload } from "lucide-react";
import { useApp, getActiveSession, type IntentData, type SocraticResponses, type ConceptClaritySummary } from "@/lib/store";
import { validateTextField, validateRequired } from "@/lib/validation";
import { generateConceptClaritySummary, evaluateSketch } from "@/lib/ai-advisory";
import { processImageFile } from "@/lib/image-utils";
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
import { UploadZone } from "./upload-zone";

const IMAGE_TYPE_OPTIONS = [
  { value: "documentary", label: "Documentary" },
  { value: "atmospheric", label: "Atmospheric" },
  { value: "material-focused", label: "Material-Focused" },
  { value: "narrative", label: "Narrative" },
];

const SOCRATIC_QUESTIONS = [
  { key: "spatialMechanism" as const, question: "What is the spatial mechanism most central to your thesis?", placeholder: "e.g. A compressed threshold that opens into a double-height volume, creating a moment of spatial release" },
  { key: "visualMoment" as const, question: "How would you express your concept in one visual moment?", placeholder: "e.g. A single figure standing at the threshold between compressed entry and expansive living space" },
  { key: "oppositeDescription" as const, question: "What is the opposite of your current description?", placeholder: "e.g. A uniform, evenly-lit open plan with no spatial hierarchy or material contrast" },
  { key: "failureScenario" as const, question: "If this project fails, what would that look like?", placeholder: "e.g. The space feels generic — the materials don't ground the user, the light doesn't create atmosphere" },
];

const emptyIntent: IntentData = {
  conceptStatement: "",
  targetUser: "",
  spatialGoal: "",
  emotionalAtmosphere: "",
  behaviorReinforcement: "",
  imageType: "",
  intentStatement: "",
  socraticResponses: { spatialMechanism: "", visualMoment: "", oppositeDescription: "", failureScenario: "" },
  conceptSketchBase64: null,
};

type FieldErrors = Partial<Record<keyof IntentData | "socratic", string[]>>;

export function IntentForm() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  const [form, setForm] = useState<IntentData>(session?.intent ?? emptyIntent);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [clarityLoading, setClarityLoading] = useState(false);
  const [claritySummary, setClaritySummary] = useState<ConceptClaritySummary | null>(session?.conceptClaritySummary ?? null);
  const [sketchFeedback, setSketchFeedback] = useState<string | null>(null);
  const [sketchLoading, setSketchLoading] = useState(false);

  useEffect(() => {
    if (session?.intent) setForm(session.intent);
    if (session?.conceptClaritySummary) setClaritySummary(session.conceptClaritySummary);
  }, [session?.intent, session?.conceptClaritySummary]);

  const filledCount = useMemo(() => {
    let count = 0;
    if (form.conceptStatement.trim().length >= 10) count++;
    if (form.targetUser.trim().length >= 10) count++;
    if (form.spatialGoal.trim().length >= 10) count++;
    if (form.emotionalAtmosphere.trim().length >= 10) count++;
    if (form.behaviorReinforcement.trim().length >= 10) count++;
    if (form.imageType) count++;
    if (form.intentStatement.trim().length >= 20) count++;
    if (form.socraticResponses?.spatialMechanism?.trim()) count++;
    if (form.socraticResponses?.visualMoment?.trim()) count++;
    if (form.socraticResponses?.oppositeDescription?.trim()) count++;
    if (form.socraticResponses?.failureScenario?.trim()) count++;
    return count;
  }, [form]);

  function update<K extends keyof IntentData>(field: K, value: IntentData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function updateSocratic(key: keyof SocraticResponses, value: string) {
    setForm((prev) => ({
      ...prev,
      socraticResponses: { ...(prev.socraticResponses || { spatialMechanism: "", visualMoment: "", oppositeDescription: "", failureScenario: "" }), [key]: value },
    }));
  }

  const handleSketchUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setSketchLoading(true);
    try {
      const processed = await processImageFile(file);
      setForm((prev) => ({ ...prev, conceptSketchBase64: processed.data }));
      const context = `Student concept: ${form.conceptStatement}. Spatial goal: ${form.spatialGoal}. Atmosphere: ${form.emotionalAtmosphere}.`;
      const feedback = await evaluateSketch(processed.data, context);
      setSketchFeedback(feedback);
    } catch {
      setSketchFeedback("Unable to evaluate sketch at this time.");
    } finally {
      setSketchLoading(false);
    }
  }, [form.conceptStatement, form.spatialGoal, form.emotionalAtmosphere]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    e.conceptStatement = validateTextField(form.conceptStatement, "Concept statement");
    e.targetUser = validateTextField(form.targetUser, "Target user");
    e.spatialGoal = validateTextField(form.spatialGoal, "Spatial goal");
    e.emotionalAtmosphere = validateTextField(form.emotionalAtmosphere, "Emotional atmosphere");
    e.behaviorReinforcement = validateTextField(form.behaviorReinforcement, "Behavior reinforcement");
    const imgReq = validateRequired(form.imageType, "Image type");
    e.imageType = imgReq ? [imgReq] : [];
    e.intentStatement = validateTextField(form.intentStatement, "Intent statement", 20);

    const cleaned: FieldErrors = {};
    for (const [k, v] of Object.entries(e)) {
      if (v && v.length > 0) cleaned[k as keyof IntentData] = v;
    }
    return cleaned;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    dispatch({ type: "SET_INTENT_DATA", payload: form });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "intent", snapshot: form } });

    setClarityLoading(true);
    try {
      const summary = await generateConceptClaritySummary(form);
      setClaritySummary(summary);
      dispatch({ type: "SET_CONCEPT_CLARITY_SUMMARY", payload: summary });
    } catch {
      setClaritySummary(null);
    } finally {
      setClarityLoading(false);
      dispatch({ type: "ADVANCE_NODE" });
    }
  }

  function handleSkip() {
    dispatch({ type: "SET_INTENT_DATA", payload: form });
    dispatch({ type: "SKIP_NODE", payload: "intent" });
  }

  const isSkipped = session?.skippedNodes.includes("intent");

  return (
    <NodeShell
      number="01"
      title="Design Mentor"
      description="Articulate the foundational intent of your visualization through guided reflection. This becomes the anchor for every decision that follows."
      icon={<Target className="w-5 h-5 text-warm" />}
      totalFields={11}
      completedFields={filledCount}
      onSkip={handleSkip}
      skipped={isSkipped}
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
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
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
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
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
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
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
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
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
            className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
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

        <div className="h-px bg-foreground/[0.06] my-2" />

        <div className="space-y-1 mb-3">
          <p className="text-[12px] font-medium text-foreground/90">Socratic Reflection</p>
          <p className="text-[11px] text-muted-foreground">
            These questions help sharpen your thinking. Answer honestly — there are no wrong answers.
          </p>
        </div>

        {SOCRATIC_QUESTIONS.map((sq) => (
          <ChallengeCard
            key={sq.key}
            label={sq.question}
            filled={!!form.socraticResponses?.[sq.key]?.trim()}
          >
            <Textarea
              value={form.socraticResponses?.[sq.key] ?? ""}
              onChange={(e) => updateSocratic(sq.key, e.target.value)}
              placeholder={sq.placeholder}
              className="min-h-[56px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            />
          </ChallengeCard>
        ))}

        <div className="h-px bg-foreground/[0.06] my-2" />

        <ChallengeCard
          label="Concept Sketch"
          hint="Draw your concept on paper and upload a photo. The AI will read and evaluate your sketch."
          filled={!!form.conceptSketchBase64}
        >
          {form.conceptSketchBase64 ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/jpeg;base64,${form.conceptSketchBase64}`} alt="Concept sketch" className="w-full h-auto max-h-[200px] object-contain bg-foreground/[0.02]" />
              </div>
              <button
                onClick={() => { setForm((p) => ({ ...p, conceptSketchBase64: null })); setSketchFeedback(null); }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Remove sketch
              </button>
              {sketchLoading && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Evaluating sketch...
                </div>
              )}
              {sketchFeedback && (
                <div className="p-3 rounded-lg bg-warm/[0.04] border border-warm/10">
                  <p className="text-[11px] text-foreground/70 leading-relaxed">{sketchFeedback}</p>
                </div>
              )}
            </div>
          ) : (
            <UploadZone
              onFiles={handleSketchUpload}
              label="Upload concept sketch"
              sublabel="Hand-drawn diagrams, sketches, wireframes"
              icon={<div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center"><Upload className="w-4 h-4 text-muted-foreground/60" /></div>}
            />
          )}
        </ChallengeCard>

        <ChallengeCard
          label="Final Intent Statement"
          hint="A complete declaration. This becomes the reference anchor for all subsequent nodes."
          filled={form.intentStatement.trim().length >= 20}
          errors={errors.intentStatement}
        >
          <Textarea
            value={form.intentStatement}
            onChange={(e) => update("intentStatement", e.target.value)}
            placeholder="Write a statement of what this image is designed to communicate, to whom, and why this specific visual approach was chosen."
            className="min-h-[80px] resize-none bg-transparent border-border text-[13px] leading-relaxed placeholder:text-muted-foreground/40"
            rows={5}
          />
        </ChallengeCard>
      </div>

      {claritySummary && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-warm" />
            <p className="text-[12px] font-medium text-foreground/90">Concept Clarity Summary</p>
          </div>
          {claritySummary.wellDefined.length > 0 && (
            <div className="p-3 rounded-lg bg-warm/[0.04] border border-warm/10 space-y-1">
              <p className="text-[10px] font-mono text-warm uppercase tracking-wider">Well Defined</p>
              {claritySummary.wellDefined.map((item, i) => (
                <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">• {item}</p>
              ))}
            </div>
          )}
          {claritySummary.ambiguous.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10 space-y-1">
              <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider">Ambiguous</p>
              {claritySummary.ambiguous.map((item, i) => (
                <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">• {item}</p>
              ))}
            </div>
          )}
          {claritySummary.suggestions.length > 0 && (
            <div className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Suggestions</p>
              {claritySummary.suggestions.map((item, i) => (
                <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">• {item}</p>
              ))}
            </div>
          )}
          {claritySummary.readings.length > 0 && (
            <div className="p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06] space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Suggested Reading</p>
              {claritySummary.readings.map((item, i) => (
                <p key={i} className="text-[11px] text-foreground/70 leading-relaxed">• {item}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {clarityLoading && (
        <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating concept clarity summary...
        </div>
      )}

      <div className="pt-4">
        <Button
          onClick={handleSubmit}
          disabled={clarityLoading}
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all"
        >
          {clarityLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>Processing...</span></>
          ) : (
            <>Save & Continue<ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </NodeShell>
  );
}

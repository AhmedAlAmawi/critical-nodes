"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardCheck, ArrowRight, RotateCcw } from "lucide-react";
import { useApp, getActiveSession, type AuditData } from "@/lib/store";
import { validateTextField } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NodeShell, ChallengeCard } from "@/components/node-shell";

const emptyAudit: AuditData = {
  alignsWellWithIntent: "",
  inconsistentPart: "",
  improvementSuggestion: "",
  mismatches: ["", "", ""],
  refinementCount: 0,
};

type FieldErrors = {
  alignsWellWithIntent?: string[];
  inconsistentPart?: string[];
  improvementSuggestion?: string[];
  mismatch_0?: string[];
  mismatch_1?: string[];
  mismatch_2?: string[];
  [key: string]: string[] | undefined;
};

export function AlignmentAudit() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isComplete = !!session?.completedAt;

  const [form, setForm] = useState<AuditData>(session?.audit ?? emptyAudit);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => { if (session?.audit) setForm(session.audit); }, [session?.audit]);

  const filledCount = useMemo(() => {
    let c = 0;
    if (form.alignsWellWithIntent.trim().length >= 10) c++;
    if (form.inconsistentPart.trim().length >= 10) c++;
    if (form.improvementSuggestion.trim().length >= 10) c++;
    if (form.mismatches[0].trim().length >= 10) c++;
    if (form.mismatches[1].trim().length >= 10) c++;
    if (form.mismatches[2].trim().length >= 10) c++;
    return c;
  }, [form]);

  function setMismatch(index: number, value: string) {
    setForm((prev) => {
      const updated: [string, string, string] = [...prev.mismatches] as [string, string, string];
      updated[index] = value;
      return { ...prev, mismatches: updated };
    });
    setErrors((prev) => ({ ...prev, [`mismatch_${index}`]: undefined }));
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const alignErrs = validateTextField(form.alignsWellWithIntent, "Alignment reflection", 10);
    if (alignErrs.length > 0) e.alignsWellWithIntent = alignErrs;
    const inconsistentErrs = validateTextField(form.inconsistentPart, "Inconsistency reflection", 10);
    if (inconsistentErrs.length > 0) e.inconsistentPart = inconsistentErrs;
    const improvementErrs = validateTextField(form.improvementSuggestion, "Improvement suggestion", 10);
    if (improvementErrs.length > 0) e.improvementSuggestion = improvementErrs;
    for (let i = 0; i < 3; i++) {
      const errs = validateTextField(form.mismatches[i], `Mismatch ${i + 1}`, 10);
      if (errs.length > 0) e[`mismatch_${i}`] = errs;
    }
    return e;
  }

  function handleSubmit() {
    if (isComplete) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch({ type: "SET_AUDIT_DATA", payload: form });
    dispatch({ type: "SAVE_NODE_REVISION", payload: { nodeId: "audit", snapshot: form } });
    dispatch({ type: "COMPLETE_SESSION" });
  }

  function handleRefine() {
    if (isComplete) return;
    dispatch({ type: "SET_AUDIT_DATA", payload: { ...form, refinementCount: form.refinementCount + 1 } });
    dispatch({ type: "REFINE_RENDER" });
  }

  return (
    <NodeShell
      number="07"
      title="Alignment Audit"
      description="Reflect on the render against your declared intent. Honest reflection here teaches more than the render itself."
      icon={<ClipboardCheck className="w-5 h-5 text-warm" />}
      totalFields={6}
      completedFields={filledCount}
    >
      {isComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warm/[0.06] border border-warm/20">
          <span className="text-[11px] text-warm font-mono tracking-wider uppercase">
            Audit Complete — Session validated and archived.
          </span>
        </div>
      )}

      {form.refinementCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.03] border border-foreground/[0.08]">
          <span className="text-[11px] text-muted-foreground font-mono">
            Refinement cycle: {form.refinementCount}
          </span>
        </div>
      )}

      <ChallengeCard
        label="Which part of the render aligns well with your declared intent?"
        hint="Identify what the AI understood and executed correctly."
        filled={form.alignsWellWithIntent.trim().length >= 10}
        errors={errors.alignsWellWithIntent}
      >
        <Textarea
          value={form.alignsWellWithIntent}
          onChange={(e) => { setForm((p) => ({ ...p, alignsWellWithIntent: e.target.value })); if (errors.alignsWellWithIntent) setErrors((p) => ({ ...p, alignsWellWithIntent: undefined })); }}
          placeholder="e.g. The stone fireplace wall is rendered with accurate material grain and warmth. The spatial hierarchy between entry and volume reads clearly."
          className="min-h-[60px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40"
          disabled={isComplete}
        />
      </ChallengeCard>

      <ChallengeCard
        label="Which part is inconsistent with what you declared?"
        hint="Be honest — this is where the learning happens."
        filled={form.inconsistentPart.trim().length >= 10}
        errors={errors.inconsistentPart}
      >
        <Textarea
          value={form.inconsistentPart}
          onChange={(e) => { setForm((p) => ({ ...p, inconsistentPart: e.target.value })); if (errors.inconsistentPart) setErrors((p) => ({ ...p, inconsistentPart: undefined })); }}
          placeholder="e.g. The lighting contradicts the declared golden hour — shadows are too sharp and the color temperature feels neutral rather than warm."
          className="min-h-[60px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40"
          disabled={isComplete}
        />
      </ChallengeCard>

      <ChallengeCard
        label="How could this be improved in a re-render?"
        hint="If you could refine the prompt, what would you change?"
        filled={form.improvementSuggestion.trim().length >= 10}
        errors={errors.improvementSuggestion}
      >
        <Textarea
          value={form.improvementSuggestion}
          onChange={(e) => { setForm((p) => ({ ...p, improvementSuggestion: e.target.value })); if (errors.improvementSuggestion) setErrors((p) => ({ ...p, improvementSuggestion: undefined })); }}
          placeholder="e.g. Specify the exact color temperature (3500K) and add mention of long, warm shadow angles to reinforce the golden hour atmosphere."
          className="min-h-[60px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40"
          disabled={isComplete}
        />
      </ChallengeCard>

      {[0, 1, 2].map((i) => (
        <ChallengeCard
          key={i}
          label={`Mismatch ${i + 1}`}
          hint="What was declared vs. what was rendered?"
          filled={form.mismatches[i].trim().length >= 10}
          errors={errors[`mismatch_${i}`]}
        >
          <Textarea
            value={form.mismatches[i]}
            onChange={(e) => setMismatch(i, e.target.value)}
            placeholder={`Describe mismatch ${i + 1}: declared X, but rendered Y`}
            className="min-h-[44px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40"
            disabled={isComplete}
          />
        </ChallengeCard>
      ))}

      {!isComplete && (
        <div className="pt-4 space-y-2">
          <Button variant="ghost" onClick={handleRefine} className="w-full h-9 text-[12px] text-muted-foreground gap-2 hover:text-foreground">
            <RotateCcw className="w-3.5 h-3.5" /> Refine — Return to Prompt & Re-render
          </Button>
          <Button onClick={handleSubmit} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all">
            Submit Audit <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

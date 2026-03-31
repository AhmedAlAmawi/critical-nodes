"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardCheck, ArrowRight, RotateCcw } from "lucide-react";
import { useApp, getActiveSession, type AuditData } from "@/lib/store";
import { validateTextField } from "@/lib/validation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NodeShell, ChallengeCard } from "@/components/node-shell";

interface ChecklistItem {
  key: keyof Pick<AuditData, "intentCommunicated" | "materialRealism" | "lightingContradiction">;
  label: string;
  description: string;
}

const CHECKLIST: ChecklistItem[] = [
  { key: "intentCommunicated", label: "Intent Communicated", description: "Does this image communicate the declared emotional atmosphere from Node 01?" },
  { key: "materialRealism", label: "Material Realism Consistent", description: "Are the declared materials rendered with consistent realism and accurate light behavior?" },
  { key: "lightingContradiction", label: "Lighting Matches Logic", description: "Does the lighting match the declared time of day, source, contrast, and shadow intention from Node 03?" },
];

const emptyAudit: AuditData = {
  intentCommunicated: null, focalHierarchy: "", materialRealism: null,
  lightingContradiction: null, accidentalElements: "", mismatches: ["", "", ""], refined: false,
};

type FieldErrors = {
  focalHierarchy?: string[]; accidentalElements?: string[]; checklist?: string;
  mismatch_0?: string[]; mismatch_1?: string[]; mismatch_2?: string[];
  [key: string]: string[] | string | undefined;
};

export function AlignmentAudit() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const isComplete = !!session?.completedAt;
  const hasRefined = session?.audit?.refined ?? false;

  const [form, setForm] = useState<AuditData>(session?.audit ?? emptyAudit);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => { if (session?.audit) setForm(session.audit); }, [session?.audit]);

  const filledCount = useMemo(() => {
    let c = 0;
    if (form.intentCommunicated !== null) c++;
    if (form.materialRealism !== null) c++;
    if (form.lightingContradiction !== null) c++;
    if (form.focalHierarchy.trim().length >= 10) c++;
    if (form.accidentalElements.trim().length >= 10) c++;
    if (form.mismatches[0].trim().length >= 10) c++;
    if (form.mismatches[1].trim().length >= 10) c++;
    if (form.mismatches[2].trim().length >= 10) c++;
    return c;
  }, [form]);

  function setChecklist(key: ChecklistItem["key"], value: boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors.checklist) setErrors((prev) => ({ ...prev, checklist: undefined }));
  }

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
    const hasNull = CHECKLIST.some((item) => form[item.key] === null);
    if (hasNull) e.checklist = "All checklist items must be answered.";
    e.focalHierarchy = validateTextField(form.focalHierarchy, "Focal hierarchy", 20);
    if (e.focalHierarchy?.length === 0) delete e.focalHierarchy;
    e.accidentalElements = validateTextField(form.accidentalElements, "Accidental elements", 20);
    if (e.accidentalElements?.length === 0) delete e.accidentalElements;
    for (let i = 0; i < 3; i++) {
      const errs = validateTextField(form.mismatches[i], `Mismatch ${i + 1}`, 20);
      if (errs.length > 0) e[`mismatch_${i}`] = errs;
    }
    return e;
  }

  function handleSubmit() {
    if (isComplete) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    dispatch({ type: "SET_AUDIT_DATA", payload: form });
    dispatch({ type: "COMPLETE_SESSION" });
  }

  function handleRefine() {
    if (hasRefined || isComplete) return;
    dispatch({ type: "SET_AUDIT_DATA", payload: { ...form, refined: true } });
    dispatch({ type: "REFINE_RENDER" });
  }

  return (
    <NodeShell
      number="06"
      title="Alignment Audit"
      description="Validate the render against your declared intent. Identify mismatches and refine if needed."
      icon={<ClipboardCheck className="w-5 h-5 text-warm" />}
      totalFields={8}
      completedFields={filledCount}
      locked={isComplete}
    >
      {isComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warm/[0.06] border border-warm/20">
          <span className="text-[11px] text-warm font-mono tracking-wider uppercase">
            Audit Complete -- Session validated and archived.
          </span>
        </div>
      )}

      {/* Checklist */}
      <ChallengeCard
        label="Validation Checklist"
        hint="Answer each criterion explicitly."
        filled={CHECKLIST.every((item) => form[item.key] !== null)}
        errors={errors.checklist ? [errors.checklist] : undefined}
      >
        <div className="space-y-2">
          {CHECKLIST.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.05]">
              <div>
                <p className="text-[12px] font-medium text-foreground/90">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" disabled={isComplete} onClick={() => setChecklist(item.key, true)}
                  className={cn("text-[10px] font-mono px-2.5 py-1 rounded-md border transition-all",
                    form[item.key] === true ? "bg-foreground text-background border-foreground" : "border-foreground/[0.1] hover:border-foreground/[0.2]",
                    isComplete && "opacity-60 cursor-not-allowed")}>Y</button>
                <button type="button" disabled={isComplete} onClick={() => setChecklist(item.key, false)}
                  className={cn("text-[10px] font-mono px-2.5 py-1 rounded-md border transition-all",
                    form[item.key] === false ? "bg-destructive text-white border-destructive" : "border-foreground/[0.1] hover:border-destructive/50",
                    isComplete && "opacity-60 cursor-not-allowed")}>N</button>
              </div>
            </div>
          ))}
        </div>
      </ChallengeCard>

      <ChallengeCard label="Focal Hierarchy" hint="Where is the viewer's eye drawn first, second, third?" filled={form.focalHierarchy.trim().length >= 10} errors={errors.focalHierarchy}>
        <Textarea value={form.focalHierarchy} onChange={(e) => { setForm((p) => ({ ...p, focalHierarchy: e.target.value })); if (errors.focalHierarchy) setErrors((p) => ({ ...p, focalHierarchy: undefined })); }}
          placeholder="e.g. 1. Stone fireplace wall 2. Light spill on floor 3. Timber ceiling plane" className="min-h-[44px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isComplete} />
      </ChallengeCard>

      <ChallengeCard label="What Feels Accidental?" hint="Identify anything in the render that was not intentionally designed." filled={form.accidentalElements.trim().length >= 10} errors={errors.accidentalElements}>
        <Textarea value={form.accidentalElements} onChange={(e) => { setForm((p) => ({ ...p, accidentalElements: e.target.value })); if (errors.accidentalElements) setErrors((p) => ({ ...p, accidentalElements: undefined })); }}
          placeholder="e.g. The shadow direction on the east wall contradicts the declared time of day" className="min-h-[44px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isComplete} />
      </ChallengeCard>

      {/* 3 Mismatches */}
      {[0, 1, 2].map((i) => (
        <ChallengeCard key={i} label={`Mismatch ${i + 1}`} hint="What was declared vs. what was rendered?" filled={form.mismatches[i].trim().length >= 10}
          errors={(() => { const mErrs = errors[`mismatch_${i}`]; return Array.isArray(mErrs) ? mErrs : undefined; })()}>
          <Textarea value={form.mismatches[i]} onChange={(e) => setMismatch(i, e.target.value)}
            placeholder={`Describe mismatch ${i + 1}`} className="min-h-[40px] resize-none bg-transparent border-border text-[12px] leading-relaxed placeholder:text-muted-foreground/40" disabled={isComplete} />
        </ChallengeCard>
      ))}

      {!isComplete && (
        <div className="pt-4 space-y-2">
          {!hasRefined && (
            <Button variant="ghost" onClick={handleRefine} className="w-full h-9 text-[12px] text-muted-foreground gap-2 hover:text-foreground">
              <RotateCcw className="w-3.5 h-3.5" /> Refine -- Re-render Once
            </Button>
          )}
          <Button onClick={handleSubmit} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2 transition-all">
            Submit Audit <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </NodeShell>
  );
}

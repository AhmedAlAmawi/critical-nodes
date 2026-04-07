"use client";

import { ArrowRight, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useApp,
  getActiveSession,
  NODE_LABELS,
  NODE_ORDER,
  getNodeStatus,
  getSkipDiagnostic,
  type NodeId,
} from "@/lib/store";
import { Button } from "@/components/ui/button";

function getCapturedSummary(session: ReturnType<typeof getActiveSession>, node: NodeId): string[] {
  if (!session) return [];
  const items: string[] = [];
  switch (node) {
    case "intent":
      if (session.intent?.conceptStatement) items.push("Concept statement defined");
      if (session.intent?.targetUser) items.push("Target user identified");
      if (session.intent?.spatialGoal) items.push("Spatial goal articulated");
      if (session.intent?.emotionalAtmosphere) items.push("Emotional atmosphere declared");
      if (session.intent?.intentStatement) items.push("Final intent statement written");
      if (session.intent?.socraticResponses?.spatialMechanism) items.push("Socratic reflections completed");
      break;
    case "visualPriority":
      if (session.visualPriority?.primaryFocusArea) items.push("Primary focus area identified");
      if (session.visualPriority?.secondaryFocusArea) items.push("Secondary focus area identified");
      if (session.visualPriority?.visualizationTarget) items.push("Visualization target defined");
      if (session.visualPriority?.sketchBase64) items.push("Concept sketch uploaded");
      break;
    case "references":
      if (session.referenceBreakdowns.length > 0) items.push(`${session.referenceBreakdowns.length} reference(s) deconstructed`);
      session.referenceBreakdowns.forEach((r, i) => {
        if (r.borrowingCategories?.length > 0) items.push(`Reference ${i + 1}: borrowing ${r.borrowingCategories.join(", ")}`);
      });
      break;
    case "geometry":
      if (session.geometryValidation?.validated) items.push("Geometry and camera view validated");
      if (session.geometryValidation?.cameraRelationship) items.push(`Camera is intentionally ${session.geometryValidation.cameraRelationship} to reference`);
      break;
    case "materialsLight":
      if (session.materialJustifications.length > 0) items.push(`${session.materialJustifications.length} material(s) justified`);
      if (session.lighting) items.push("Lighting logic defined");
      if (session.lighting?.preset) items.push(`Lighting preset: ${session.lighting.preset}`);
      break;
    case "prompt":
      if (session.promptFields) items.push("Prompt fields configured");
      break;
    case "audit":
      if (session.audit?.alignsWellWithIntent) items.push("Alignment reflection completed");
      if (session.audit?.refinementCount && session.audit.refinementCount > 0) items.push(`${session.audit.refinementCount} refinement(s) made`);
      break;
  }
  return items;
}

function getMissingItems(session: ReturnType<typeof getActiveSession>, node: NodeId): string[] {
  if (!session) return [];
  const missing: string[] = [];
  switch (node) {
    case "intent":
      if (!session.intent?.conceptStatement) missing.push("Concept statement");
      if (!session.intent?.intentStatement) missing.push("Final intent statement");
      if (!session.intent?.socraticResponses?.spatialMechanism) missing.push("Socratic reflections");
      break;
    case "visualPriority":
      if (!session.visualPriority?.visualizationTarget) missing.push("Visualization target");
      if (!session.visualPriority?.sketchBase64) missing.push("Concept sketch");
      break;
    case "references":
      if (session.referenceBreakdowns.length === 0) missing.push("Reference breakdowns");
      break;
    case "geometry":
      if (!session.geometryValidation?.validated) missing.push("Geometry validation");
      break;
    case "materialsLight":
      if (session.materialJustifications.length === 0) missing.push("Material justifications");
      if (!session.lighting) missing.push("Lighting logic");
      break;
    case "prompt":
      if (!session.promptFields) missing.push("Prompt configuration");
      break;
    case "audit":
      if (!session.audit?.alignsWellWithIntent) missing.push("Alignment reflection");
      break;
  }
  return missing;
}

const DOWNSTREAM_IMPACT: Record<NodeId, string> = {
  intent: "Your intent anchors all material, lighting, reference, and prompt decisions. A strong intent produces a coherent visualization.",
  visualPriority: "The visualization target focuses your camera, composition, and material hierarchy in later nodes.",
  references: "Reference analysis informs your prompt by declaring what visual strategies to borrow or avoid.",
  geometry: "The validated geometry locks your camera view — all materials, lighting, and composition build on this perspective.",
  materialsLight: "Material and lighting choices directly translate into the render prompt and determine visual quality.",
  prompt: "The prompt is the direct instruction to the AI. Precision here determines render quality.",
  audit: "Reflection closes the learning loop. Identifying mismatches teaches you to make better declarations next time.",
};

interface NodeExitSummaryProps {
  onContinue?: (nextNode: NodeId) => void;
}

export function NodeExitSummary({ onContinue }: NodeExitSummaryProps) {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);
  const exitNode = state.showExitSummary;

  if (!exitNode || !session) return null;

  const status = getNodeStatus(session, exitNode);
  const captured = getCapturedSummary(session, exitNode);
  const missing = getMissingItems(session, exitNode);
  const impact = DOWNSTREAM_IMPACT[exitNode];
  const isSkipped = session.skippedNodes.includes(exitNode);
  const diagnostic = isSkipped ? getSkipDiagnostic(exitNode) : null;

  const nextIdx = NODE_ORDER.indexOf(exitNode) + 1;
  const nextNode = nextIdx < NODE_ORDER.length ? NODE_ORDER[nextIdx] : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6"
        onClick={() => dispatch({ type: "SHOW_EXIT_SUMMARY", payload: null })}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-background rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <p className="text-[10px] font-mono tracking-wider uppercase text-warm mb-1">
              {isSkipped ? "Node Skipped" : "Node Complete"}
            </p>
            <h3 className="text-[16px] font-medium text-foreground">
              {NODE_LABELS[exitNode]}
            </h3>
          </div>

          {diagnostic && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                {diagnostic}
              </p>
            </div>
          )}

          {captured.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                Captured
              </p>
              {captured.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-warm shrink-0" />
                  <span className="text-[12px] text-foreground/80">{item}</span>
                </div>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                Missing
              </p>
              {missing.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="text-[12px] text-foreground/60">{item}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
              How this influences later steps
            </p>
            <p className="text-[12px] text-foreground/70 leading-relaxed">
              {impact}
            </p>
          </div>

          <Button
            onClick={() => {
              dispatch({ type: "SHOW_EXIT_SUMMARY", payload: null });
              if (nextNode && onContinue) onContinue(nextNode);
            }}
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2"
          >
            {nextNode ? (
              <>
                Continue to {NODE_LABELS[nextNode]}
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              "Close"
            )}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

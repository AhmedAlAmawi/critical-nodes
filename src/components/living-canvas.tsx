"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Eye, Image as ImageIcon, Box, Palette, Sun, Layers, ClipboardCheck,
  Sparkles, Download, Copy, Maximize2,
} from "lucide-react";
import {
  useApp,
  getActiveSession,
  NODE_ORDER,
  NODE_LABELS,
  getNodeStatus,
  type NodeId,
  type Session,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NODE_ICONS: Record<NodeId, React.ElementType> = {
  intent: Target,
  visualPriority: Eye,
  references: ImageIcon,
  geometry: Box,
  materialsLight: Palette,
  prompt: Layers,
  audit: ClipboardCheck,
};

interface CanvasCardProps {
  nodeId: NodeId;
  filled: boolean;
  onClick: () => void;
  span?: "single" | "double" | "full";
  children?: React.ReactNode;
}

function CanvasCard({ nodeId, filled, onClick, span = "single", children }: CanvasCardProps) {
  const Icon = NODE_ICONS[nodeId];
  const label = NODE_LABELS[nodeId];
  const idx = NODE_ORDER.indexOf(nodeId);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className={cn(
        "group relative text-left rounded-2xl border transition-all duration-200 overflow-hidden",
        span === "double" && "col-span-2",
        span === "full" && "col-span-full",
        filled
          ? "border-foreground/[0.08] bg-background hover:border-foreground/[0.15] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] cursor-pointer"
          : "border-dashed border-foreground/[0.08] bg-foreground/[0.01] hover:border-foreground/[0.14] hover:bg-foreground/[0.02] cursor-pointer"
      )}
    >
      {filled ? (
        <div className="p-5 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-warm/10 flex items-center justify-center">
              <Icon className="w-3 h-3 text-warm" />
            </div>
            <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
              {String(idx + 1).padStart(2, "0")} {label}
            </span>
          </div>
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        <div className="p-5 h-full flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-10 h-10 rounded-xl border border-dashed border-foreground/[0.1] flex items-center justify-center mb-3">
            <Icon className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/40 tracking-wider uppercase mb-1">
            {String(idx + 1).padStart(2, "0")} {label}
          </p>
          <p className="text-[10px] text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors">
            Click to begin
          </p>
        </div>
      )}
    </motion.button>
  );
}

function RenderPreviewCard({ onClick }: { onClick: () => void }) {
  const { state } = useApp();
  const [copied, setCopied] = useState(false);

  const dataUrl =
    state.renderResult && state.renderMimeType
      ? `data:${state.renderMimeType};base64,${state.renderResult}`
      : null;

  if (state.isRendering) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="col-span-full rounded-2xl border border-foreground/[0.08] bg-background p-8"
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 rounded-xl bg-warm/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-warm animate-pulse" />
          </div>
          <p className="text-[12px] text-muted-foreground">Generating render... {state.renderProgress}%</p>
          <div className="w-48 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-warm/60 transition-all duration-500" style={{ width: `${state.renderProgress}%` }} />
          </div>
        </div>
      </motion.div>
    );
  }

  if (!dataUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `critical-nodes-${Date.now()}.png`;
    a.click();
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      await navigator.clipboard.writeText(dataUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="col-span-full rounded-2xl border border-warm/20 bg-background overflow-hidden group cursor-pointer hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-shadow"
      onClick={onClick}
    >
      <div className="p-4 flex items-center justify-between border-b border-foreground/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-warm/10 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-warm" />
          </div>
          <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">Render Result</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleDownload} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCopy} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="Render" className="w-full h-auto max-h-[50vh] object-contain bg-foreground/[0.02]" />
      {copied && <p className="text-[10px] text-warm text-center py-1">Copied!</p>}
    </motion.div>
  );
}

function getIntentCardContent(session: Session) {
  if (!session.intent) return null;
  return (
    <div className="space-y-2">
      {session.intent.intentStatement && (
        <p className="text-[13px] text-foreground/80 leading-relaxed font-medium line-clamp-3">
          {session.intent.intentStatement}
        </p>
      )}
      <div className="space-y-1">
        {session.intent.emotionalAtmosphere && (
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            <span className="text-muted-foreground/40">Atmosphere:</span> {session.intent.emotionalAtmosphere}
          </p>
        )}
        {session.intent.imageType && (
          <span className="inline-block text-[9px] px-2 py-0.5 rounded-md bg-warm/8 text-warm capitalize">
            {session.intent.imageType}
          </span>
        )}
      </div>
    </div>
  );
}

interface LivingCanvasProps {
  onOpenDrawer: (nodeId: NodeId) => void;
  onOpenRenderFullscreen: () => void;
}

export function LivingCanvas({ onOpenDrawer, onOpenRenderFullscreen }: LivingCanvasProps) {
  const { state } = useApp();
  const session = getActiveSession(state);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="font-display text-2xl text-foreground/20 mb-3">Critical Nodes</p>
          <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
            A structured visualization discipline tool that helps students articulate, justify, and align visual decisions when using AI in design education.
          </p>
          <p className="text-[12px] text-muted-foreground/30 mt-4">Start a session to begin.</p>
        </div>
      </div>
    );
  }

  const hasIntent = !!session.intent;
  const hasSketch = !!session.intent?.conceptSketchBase64;
  const hasVisualPriority = !!session.visualPriority;
  const hasPrioritySketch = !!session.visualPriority?.sketchBase64;
  const hasReferences = session.referenceBreakdowns.length > 0;
  const hasGeometry = !!session.geometryValidation;
  const hasMaterials = session.materialJustifications.length > 0;
  const hasLighting = !!session.lighting;
  const hasRender = !!state.renderResult;
  const hasAudit = !!session.audit;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto p-6 pb-20">
        <div className="mb-6">
          <p className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground/40 mb-1">Design Brief</p>
          <h1 className="font-display text-xl text-foreground/70">{session.name}</h1>
        </div>

        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Intent Card -- always first, spans 2 on large */}
            <CanvasCard nodeId="intent" filled={hasIntent} onClick={() => onOpenDrawer("intent")} span={hasIntent ? "double" : "single"}>
              {hasIntent && getIntentCardContent(session)}
            </CanvasCard>

            {/* Concept Sketch */}
            {hasSketch ? (
              <CanvasCard nodeId="intent" filled onClick={() => onOpenDrawer("intent")} key="concept-sketch">
                <div className="rounded-lg overflow-hidden border border-foreground/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/jpeg;base64,${session.intent!.conceptSketchBase64}`} alt="Concept sketch" className="w-full h-auto max-h-[140px] object-contain bg-foreground/[0.02]" />
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2">Concept Sketch</p>
              </CanvasCard>
            ) : !hasIntent && (
              <div key="concept-sketch-placeholder" />
            )}

            {/* Visual Priority */}
            <CanvasCard nodeId="visualPriority" filled={hasVisualPriority} onClick={() => onOpenDrawer("visualPriority")}>
              {hasVisualPriority && (
                <div className="space-y-2">
                  {session.visualPriority!.visualizationTarget && (
                    <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-3">
                      {session.visualPriority!.visualizationTarget}
                    </p>
                  )}
                  {session.visualPriority!.primaryFocusArea && (
                    <p className="text-[10px] text-muted-foreground/50">
                      Focus: {session.visualPriority!.primaryFocusArea}
                    </p>
                  )}
                </div>
              )}
            </CanvasCard>

            {/* Priority Sketch */}
            {hasPrioritySketch && (
              <CanvasCard nodeId="visualPriority" filled onClick={() => onOpenDrawer("visualPriority")} key="priority-sketch">
                <div className="rounded-lg overflow-hidden border border-foreground/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:image/jpeg;base64,${session.visualPriority!.sketchBase64}`} alt="Priority sketch" className="w-full h-auto max-h-[140px] object-contain bg-foreground/[0.02]" />
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2">Priority Sketch</p>
              </CanvasCard>
            )}

            {/* Reference Cards */}
            {hasReferences ? (
              session.referenceBreakdowns.map((ref, i) => (
                <CanvasCard nodeId="references" filled onClick={() => onOpenDrawer("references")} key={`ref-${ref.id}`}>
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-muted-foreground/50">Reference {i + 1}</p>
                    <p className="text-[11px] text-foreground/60 leading-relaxed">{ref.lens} / {ref.framing} / {ref.tone}</p>
                    {ref.borrowingCategories?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ref.borrowingCategories.map((cat) => (
                          <span key={cat} className="text-[8px] px-1.5 py-0.5 rounded bg-warm/8 text-warm/80">{cat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </CanvasCard>
              ))
            ) : (
              <CanvasCard nodeId="references" filled={false} onClick={() => onOpenDrawer("references")} key="ref-ghost" />
            )}

            {/* Model / Geometry */}
            <CanvasCard nodeId="geometry" filled={hasGeometry || !!state.modelImage} onClick={() => onOpenDrawer("geometry")}>
              {state.modelImage && (
                <div className="space-y-2">
                  <div className="rounded-lg overflow-hidden border border-foreground/[0.05]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={state.modelImage.preview} alt="Model" className="w-full h-auto max-h-[140px] object-contain bg-foreground/[0.02]" />
                  </div>
                  {session.geometryValidation?.cameraRelationship && (
                    <span className="inline-block text-[9px] px-2 py-0.5 rounded-md bg-foreground/[0.04] text-foreground/60">
                      Camera: {session.geometryValidation.cameraRelationship} to ref
                    </span>
                  )}
                </div>
              )}
            </CanvasCard>

            {/* Materials */}
            <CanvasCard nodeId="materialsLight" filled={hasMaterials || hasLighting} onClick={() => onOpenDrawer("materialsLight")}>
              {(hasMaterials || hasLighting) && (
                <div className="space-y-2">
                  {hasMaterials && (
                    <div className="flex flex-wrap gap-1.5">
                      {session.materialJustifications.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-foreground/[0.03] border border-foreground/[0.05]">
                          <div className="w-2.5 h-2.5 rounded-full bg-warm/30" />
                          <span className="text-foreground/60">{m.materialName || "Unnamed"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasLighting && (
                    <div className="flex items-center gap-2">
                      <Sun className="w-3 h-3 text-warm/50" />
                      <span className="text-[10px] text-foreground/50">
                        {session.lighting!.preset && session.lighting!.preset !== "custom"
                          ? session.lighting!.preset.replace("-", " ")
                          : session.lighting!.timeOfDay || "Custom lighting"
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CanvasCard>

            {/* Prompt node -- ghost when not yet configured */}
            {!hasRender && !state.isRendering && (
              <CanvasCard nodeId="prompt" filled={!!session.promptFields} onClick={() => onOpenDrawer("prompt")}>
                {session.promptFields && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-foreground/50">Lens: {session.promptFields.lens}</p>
                    <p className="text-[10px] text-foreground/50">Mood: {session.promptFields.mood}</p>
                  </div>
                )}
              </CanvasCard>
            )}

            {/* Render Result -- large card */}
            {(hasRender || state.isRendering) && (
              <RenderPreviewCard key="render" onClick={onOpenRenderFullscreen} />
            )}

            {/* Audit */}
            {hasRender && (
              <CanvasCard nodeId="audit" filled={hasAudit} onClick={() => onOpenDrawer("audit")} span={hasAudit ? "double" : "single"}>
                {hasAudit && (
                  <div className="space-y-2">
                    {session.audit!.alignsWellWithIntent && (
                      <div>
                        <p className="text-[9px] font-mono text-warm/60 uppercase tracking-wider mb-0.5">Aligns Well</p>
                        <p className="text-[11px] text-foreground/60 leading-relaxed line-clamp-2">{session.audit!.alignsWellWithIntent}</p>
                      </div>
                    )}
                    {session.audit!.inconsistentPart && (
                      <div>
                        <p className="text-[9px] font-mono text-amber-500/60 uppercase tracking-wider mb-0.5">Inconsistent</p>
                        <p className="text-[11px] text-foreground/60 leading-relaxed line-clamp-2">{session.audit!.inconsistentPart}</p>
                      </div>
                    )}
                  </div>
                )}
              </CanvasCard>
            )}

          </div>
        </AnimatePresence>
      </div>
    </div>
  );
}

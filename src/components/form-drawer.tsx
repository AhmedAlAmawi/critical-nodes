"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { NODE_LABELS, NODE_ORDER, type NodeId } from "@/lib/store";
import { IntentForm } from "@/components/intent-form";
import { VisualPriorityLocator } from "@/components/visual-priority-locator";
import { ReferenceDeconstruction } from "@/components/reference-deconstruction";
import { GeometryValidation } from "@/components/geometry-validation";
import { MaterialsLightValidation } from "@/components/materials-light-validation";
import { PromptArchitecture } from "@/components/prompt-architecture";
import { AlignmentAudit } from "@/components/alignment-audit";
import { ReferenceLibrary } from "@/components/reference-library";
import { SessionList } from "@/components/session-list";

function ActiveNodeForm({ activeNode }: { activeNode: NodeId }) {
  switch (activeNode) {
    case "intent":
      return <IntentForm />;
    case "visualPriority":
      return <VisualPriorityLocator />;
    case "references":
      return <ReferenceDeconstruction />;
    case "geometry":
      return <GeometryValidation />;
    case "materialsLight":
      return <MaterialsLightValidation />;
    case "prompt":
      return <PromptArchitecture />;
    case "audit":
      return <AlignmentAudit />;
    default:
      return <IntentForm />;
  }
}

interface FormDrawerProps {
  open: boolean;
  onClose: () => void;
  activeNode: NodeId;
  showSessionList: boolean;
}

export function FormDrawer({ open, onClose, activeNode, showSessionList }: FormDrawerProps) {
  const idx = NODE_ORDER.indexOf(activeNode);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/15 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "-100%", opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0.8 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-40 w-[480px] max-w-[90vw] flex flex-col bg-background border-r border-foreground/[0.07] shadow-[4px_0_40px_rgba(0,0,0,0.1)]"
          >
            {/* Header */}
            <div className="shrink-0 h-14 px-5 flex items-center justify-between border-b border-border">
              {showSessionList ? (
                <span className="text-[13px] font-medium text-foreground">Sessions</span>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[20px] font-display text-foreground/[0.06] leading-none select-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-foreground leading-tight">{NODE_LABELS[activeNode]}</p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono tracking-wider uppercase">Node {String(idx + 1).padStart(2, "0")}</p>
                  </div>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
              {showSessionList ? (
                <SessionList />
              ) : (
                <ActiveNodeForm activeNode={activeNode} />
              )}
            </div>

            {/* Footer -- Reference Library (collapsed by default) */}
            {!showSessionList && (
              <div className="shrink-0 border-t border-border p-3">
                <ReferenceLibrary />
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

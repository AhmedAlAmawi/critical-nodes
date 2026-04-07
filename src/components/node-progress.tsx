"use client";

import { Check, AlertTriangle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApp,
  getActiveSession,
  NODE_ORDER,
  NODE_LABELS,
  getNodeStatus,
  getSkipDiagnostic,
  type NodeId,
} from "@/lib/store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function NodeProgress() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  if (!session) return null;

  return (
    <div className="flex items-center gap-0.5 px-1">
      {NODE_ORDER.map((nodeId, idx) => {
        const status = getNodeStatus(session, nodeId);
        const active = state.activeNode === nodeId;
        const diagnostic = status === "skipped" || status === "empty" ? getSkipDiagnostic(nodeId) : null;

        const button = (
          <button
            key={nodeId}
            onClick={() => dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId })}
            className={cn(
              "group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all duration-200",
              active && "bg-foreground/[0.08] text-foreground",
              status === "complete" && !active && "text-warm hover:bg-foreground/[0.04] cursor-pointer",
              status === "partial" && !active && "text-amber-500 hover:bg-foreground/[0.04] cursor-pointer",
              status === "skipped" && !active && "text-muted-foreground/50 hover:bg-foreground/[0.04] cursor-pointer",
              status === "empty" && !active && "text-muted-foreground hover:bg-foreground/[0.04] cursor-pointer"
            )}
          >
            <span className="flex items-center justify-center w-4 h-4 shrink-0">
              {status === "complete" ? (
                <Check className="w-3 h-3 text-warm" strokeWidth={2.5} />
              ) : status === "partial" ? (
                <AlertTriangle className="w-3 h-3 text-amber-500" />
              ) : status === "skipped" ? (
                <SkipForward className="w-2.5 h-2.5 text-muted-foreground/50" />
              ) : (
                <span
                  className={cn(
                    "text-[9px] font-mono tabular-nums",
                    active ? "text-warm" : "text-muted-foreground"
                  )}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
              )}
            </span>

            <span className="hidden xl:inline whitespace-nowrap">
              {NODE_LABELS[nodeId]}
            </span>

            {active && (
              <div className="absolute -bottom-[1px] left-2 right-2 h-[2px] bg-warm rounded-full" />
            )}
          </button>
        );

        if (diagnostic) {
          return (
            <Tooltip key={nodeId}>
              <TooltipTrigger
                onClick={() => dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId })}
                className={cn(
                  "group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all duration-200",
                  active && "bg-foreground/[0.08] text-foreground",
                  status === "complete" && !active && "text-warm hover:bg-foreground/[0.04] cursor-pointer",
                  status === "partial" && !active && "text-amber-500 hover:bg-foreground/[0.04] cursor-pointer",
                  status === "skipped" && !active && "text-muted-foreground/50 hover:bg-foreground/[0.04] cursor-pointer",
                  status === "empty" && !active && "text-muted-foreground hover:bg-foreground/[0.04] cursor-pointer"
                )}
              >
                <span className="flex items-center justify-center w-4 h-4 shrink-0">
                  {status === "skipped" ? (
                    <SkipForward className="w-2.5 h-2.5 text-muted-foreground/50" />
                  ) : (
                    <span className={cn("text-[9px] font-mono tabular-nums", active ? "text-warm" : "text-muted-foreground")}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  )}
                </span>
                <span className="hidden xl:inline whitespace-nowrap">{NODE_LABELS[nodeId]}</span>
                {active && <div className="absolute -bottom-[1px] left-2 right-2 h-[2px] bg-warm rounded-full" />}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-[11px]">
                {diagnostic}
              </TooltipContent>
            </Tooltip>
          );
        }

        return button;
      })}
    </div>
  );
}

export function NodeProgressCompact() {
  const { state } = useApp();
  const session = getActiveSession(state);

  if (!session) return null;

  const currentIdx = NODE_ORDER.indexOf(session.currentNode);
  const totalNodes = NODE_ORDER.length;

  return (
    <div className="flex items-center gap-1.5">
      {NODE_ORDER.map((nodeId, idx) => {
        const status = getNodeStatus(session, nodeId);
        const active = state.activeNode === nodeId;

        return (
          <div
            key={nodeId}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              idx === 0 ? "w-6" : "w-4",
              status === "complete" && "bg-warm",
              status === "partial" && "bg-amber-400",
              status === "skipped" && "bg-muted-foreground/20",
              active && status === "empty" && "bg-warm/80",
              !active && status === "empty" && "bg-foreground/[0.08]"
            )}
          />
        );
      })}
      <span className="text-[10px] text-muted-foreground/50 font-mono ml-1">
        {currentIdx}/{totalNodes}
      </span>
    </div>
  );
}

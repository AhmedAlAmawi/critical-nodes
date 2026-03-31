"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useApp,
  getActiveSession,
  NODE_ORDER,
  NODE_LABELS,
  canAccessNode,
  isNodeComplete,
  type NodeId,
} from "@/lib/store";

export function NodeProgress() {
  const { state, dispatch } = useApp();
  const session = getActiveSession(state);

  if (!session) return null;

  return (
    <div className="flex items-center gap-0.5 px-1">
      {NODE_ORDER.map((nodeId, idx) => {
        const completed = isNodeComplete(session, nodeId);
        const active = state.activeNode === nodeId;
        const accessible = canAccessNode(session, nodeId);
        const locked = !accessible;

        return (
          <button
            key={nodeId}
            onClick={() => {
              if (accessible) dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
            }}
            disabled={locked}
            className={cn(
              "group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all duration-200",
              active && "bg-foreground/[0.08] text-foreground",
              completed && !active && "text-warm hover:bg-foreground/[0.04] cursor-pointer",
              locked && "text-muted-foreground/30 cursor-not-allowed",
              !active && !completed && accessible && "text-muted-foreground hover:bg-foreground/[0.04] cursor-pointer"
            )}
          >
            <span className="flex items-center justify-center w-4 h-4 shrink-0">
              {completed ? (
                <Check className="w-3 h-3 text-warm" strokeWidth={2.5} />
              ) : locked ? (
                <Lock className="w-2.5 h-2.5" />
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
        const completed = idx < currentIdx;
        const active = state.activeNode === nodeId;

        return (
          <div
            key={nodeId}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              idx === 0 ? "w-6" : "w-4",
              completed && "bg-warm",
              active && "bg-warm/80",
              !completed && !active && "bg-foreground/[0.08]"
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

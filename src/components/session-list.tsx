"use client";

import { Plus, Trash2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, NODE_ORDER, NODE_LABELS, type Session } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SessionCard({ session, isActive }: { session: Session; isActive: boolean }) {
  const { dispatch } = useApp();
  const currentIdx = NODE_ORDER.indexOf(session.currentNode);
  const isComplete = !!session.completedAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "group border rounded-xl p-4 transition-all duration-200 cursor-pointer",
        isActive
          ? "border-warm/30 bg-warm/[0.05]"
          : "border-foreground/[0.08] hover:border-foreground/[0.14] bg-foreground/[0.01]"
      )}
      onClick={() => dispatch({ type: "SET_ACTIVE_SESSION", payload: session.id })}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-[13px] font-medium text-foreground truncate">{session.name}</h3>
            {isComplete && (
              <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-warm/10 text-warm shrink-0">Complete</span>
            )}
          </div>

          {session.intent?.intentStatement ? (
            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">{session.intent.intentStatement}</p>
          ) : (
            <p className="text-[12px] text-muted-foreground/60 italic mb-2.5">No intent defined yet</p>
          )}

          <div className="flex items-center gap-1">
            {NODE_ORDER.map((nodeId, idx) => {
              const done = idx < currentIdx;
              const current = nodeId === session.currentNode && !isComplete;
              return (
                <div key={nodeId} className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === 0 ? "w-6" : "w-4",
                  done && "bg-warm",
                  current && "bg-warm/50",
                  !done && !current && "bg-foreground/[0.08]"
                )} />
              );
            })}
            <span className="text-[10px] text-muted-foreground font-mono ml-1.5">
              {isComplete ? "Done" : NODE_LABELS[session.currentNode]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this session?")) dispatch({ type: "DELETE_SESSION", payload: session.id }); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">{new Date(session.createdAt).toLocaleDateString()}</p>
    </motion.div>
  );
}

export function SessionList() {
  const { state, dispatch } = useApp();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg text-foreground">Sessions</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">Each session is a gated validation process.</p>
      </div>

      <Button onClick={() => dispatch({ type: "CREATE_SESSION" })} className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] gap-2">
        <Plus className="w-4 h-4" /> New Session
      </Button>

      <div className="space-y-2">
        <AnimatePresence>
          {state.sessions.map((session) => (
            <SessionCard key={session.id} session={session} isActive={session.id === state.activeSessionId} />
          ))}
        </AnimatePresence>
        {state.sessions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[13px] text-muted-foreground/60">No sessions yet. Start one to begin the validation process.</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useReducer, useEffect, useState } from "react";
import {
  AppContext,
  appReducer,
  initialState,
  getActiveSession,
  loadSessions,
  saveSessions,
  loadHistory,
  saveHistory,
} from "@/lib/store";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/logo";
import { NodeProgress } from "@/components/node-progress";
import { SessionList } from "@/components/session-list";
import { IntentForm } from "@/components/intent-form";
import { MaterialLogic } from "@/components/material-logic";
import { LightingForm } from "@/components/lighting-form";
import { ReferenceDeconstruction } from "@/components/reference-deconstruction";
import { PromptArchitecture } from "@/components/prompt-architecture";
import { AlignmentAudit } from "@/components/alignment-audit";
import { IntentSummary } from "@/components/intent-summary";
import { RenderResult } from "@/components/render-result";
import { SettingsDialog } from "@/components/settings-dialog";
import { ArrowLeft } from "lucide-react";

function ActiveNodeForm({ activeNode }: { activeNode: string }) {
  switch (activeNode) {
    case "intent":
      return <IntentForm />;
    case "materials":
      return <MaterialLogic />;
    case "lighting":
      return <LightingForm />;
    case "references":
      return <ReferenceDeconstruction />;
    case "prompt":
      return <PromptArchitecture />;
    case "audit":
      return <AlignmentAudit />;
    default:
      return <IntentForm />;
  }
}

function RightPanel({ activeNode }: { activeNode: string }) {
  if (activeNode === "prompt" || activeNode === "audit") {
    return <RenderResult />;
  }
  return <IntentSummary />;
}

export default function StudioPage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const session = getActiveSession(state);

  useEffect(() => {
    const sessions = loadSessions();
    if (sessions.length > 0) dispatch({ type: "LOAD_SESSIONS", payload: sessions });
    const history = loadHistory();
    if (history.length > 0) dispatch({ type: "LOAD_HISTORY", payload: history });
  }, []);

  useEffect(() => {
    saveSessions(state.sessions);
  }, [state.sessions]);

  useEffect(() => {
    if (state.history.length > 0) saveHistory(state.history);
  }, [state.history]);

  const showSessionList = !state.activeSessionId;

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="h-screen overflow-hidden p-2.5 pt-[52px] flex gap-2.5">
        {/* Left panel */}
        <aside className="w-[370px] shrink-0 flex flex-col overflow-hidden rounded-2xl bg-background border border-foreground/[0.07] shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          {/* Header */}
          <div className="shrink-0 px-5 h-14 flex items-center justify-between border-b border-border">
            {showSessionList ? (
              <Logo size="md" />
            ) : (
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => dispatch({ type: "SET_ACTIVE_SESSION", payload: null })}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="font-mono tracking-wider uppercase">Sessions</span>
                </button>
              </div>
            )}
          </div>

          {/* Progress bar (only when in a session) */}
          {session && (
            <div className="shrink-0 border-b border-border py-1.5 overflow-x-auto scrollbar-thin">
              <NodeProgress />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            {showSessionList ? (
              <SessionList />
            ) : (
              <ActiveNodeForm activeNode={state.activeNode} />
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 flex flex-col overflow-hidden rounded-2xl bg-background border border-border shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <RightPanel activeNode={state.activeNode} />
        </main>
      </div>

      <Nav onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AppContext.Provider>
  );
}

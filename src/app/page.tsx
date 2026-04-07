"use client";

import { useReducer, useEffect, useState, useCallback } from "react";
import { Wand2 } from "lucide-react";
import {
  AppContext,
  appReducer,
  initialState,
  getActiveSession,
  loadSessions,
  saveSessions,
  loadHistory,
  saveHistory,
  type NodeId,
} from "@/lib/store";
import { Nav } from "@/components/nav";
import { LivingCanvas } from "@/components/living-canvas";
import { FormDrawer } from "@/components/form-drawer";
import { NodeExitSummary } from "@/components/node-exit-summary";
import { RenderResult } from "@/components/render-result";
import { SettingsDialog } from "@/components/settings-dialog";

export default function StudioPage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renderFullscreen, setRenderFullscreen] = useState(false);
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

  // Auto-open drawer when a session is selected and no session was active before
  useEffect(() => {
    if (state.activeSessionId && !drawerOpen) {
      setDrawerOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSessionId]);

  // Close drawer when exit summary appears (node just completed)
  useEffect(() => {
    if (state.showExitSummary) {
      setDrawerOpen(false);
    }
  }, [state.showExitSummary]);

  const handleOpenDrawer = useCallback((nodeId: NodeId) => {
    dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
    setDrawerOpen(true);
  }, [dispatch]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const showSessionList = !state.activeSessionId;

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="h-screen overflow-hidden flex flex-col pt-[52px]">
        {/* Living Canvas -- full screen background */}
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          {showSessionList ? (
            <LivingCanvas onOpenDrawer={handleOpenDrawer} onOpenRenderFullscreen={() => setRenderFullscreen(true)} />
          ) : (
            <LivingCanvas onOpenDrawer={handleOpenDrawer} onOpenRenderFullscreen={() => setRenderFullscreen(true)} />
          )}
        </main>
      </div>

      {/* Form Drawer -- slides over canvas */}
      <FormDrawer
        open={drawerOpen || showSessionList}
        onClose={handleCloseDrawer}
        activeNode={state.activeNode}
        showSessionList={showSessionList}
      />

      {/* Nav with integrated node progress */}
      <Nav
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDrawer={handleOpenDrawer}
        session={session}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Exit summary modal */}
      {state.showExitSummary && <NodeExitSummary onContinue={handleOpenDrawer} />}

      {/* Render fullscreen lightbox */}
      {renderFullscreen && (
        <RenderResult mode="fullscreen" onClose={() => setRenderFullscreen(false)} />
      )}

      {/* Dev: Mock Fill button */}
      {process.env.NODE_ENV === "development" && session && (
        <button
          onClick={() => {
            dispatch({ type: "MOCK_FILL_SESSION" });
            setDrawerOpen(false);
          }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-mono tracking-wide uppercase bg-warm/10 text-warm border border-warm/20 hover:bg-warm/20 transition-colors shadow-lg backdrop-blur-sm"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Mock Fill
        </button>
      )}
    </AppContext.Provider>
  );
}

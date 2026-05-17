/**
 * VisualizeShell — Stage B host. Wires the existing v2 LivingCanvas + FormDrawer
 * + Nav into the v3 routing world, with a sidecar that mirrors session state
 * into Postgres via /api/sessions/[id]/state.
 *
 * Rationale: rewriting the v2 reducer into server-backed state is a large
 * change that risks regressing existing UX. Mirroring the reducer's session
 * into session_node_state on every dispatch is non-invasive and reversible.
 */

"use client";

import Link from "next/link";
import { useReducer, useEffect, useState, useCallback } from "react";
import {
  AppContext,
  appReducer,
  initialState,
  createEmptySession,
  getActiveSession,
  loadHistory,
  saveHistory,
  type NodeId,
  type Session,
  type IntentData,
  type VisualPriorityData,
  type ReferenceBreakdown,
  type GeometryValidationData,
  type MaterialJustification,
  type LightingData,
  type PromptFields,
  type AuditData,
} from "@/lib/store";
import { Nav } from "@/components/nav";
import { LivingCanvas } from "@/components/living-canvas";
import { FormDrawer } from "@/components/form-drawer";
import { NodeExitSummary } from "@/components/node-exit-summary";
import { RenderResult } from "@/components/render-result";
import { SettingsDialog } from "@/components/settings-dialog";

type Props = { sessionId: number };

export function VisualizeShell({ sessionId }: Props) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renderFullscreen, setRenderFullscreen] = useState(false);
  const session = getActiveSession(state);

  // Bootstrap from SERVER state, not localStorage. This is the v3 fix —
  // /studio/[id]/visualize must hydrate the v2 reducer from session_node_state
  // so the canvas renders the student's persisted Stage B work.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          session: { id: number; status: string };
          states: Array<{ node_id: string; data: Record<string, unknown> | null }>;
        };
        if (cancelled) return;
        const sid = String(sessionId);
        const map: Record<string, Record<string, unknown> | null> = {};
        for (const s of j.states) map[s.node_id] = s.data;
        const built: Session = {
          ...createEmptySession(`Session ${sessionId}`),
          id: sid,
          intent: (map.intent as IntentData | null) ?? null,
          visualPriority:
            (map.visualPriority as VisualPriorityData | null) ?? null,
          referenceBreakdowns:
            ((map.references as { breakdowns?: ReferenceBreakdown[] } | null)
              ?.breakdowns ?? []),
          geometryValidation:
            (map.geometry as GeometryValidationData | null) ?? null,
          materialJustifications:
            ((map.materialsLight as {
              materials?: MaterialJustification[];
            } | null)?.materials ?? []),
          lighting:
            ((map.materialsLight as { lighting?: LightingData } | null)
              ?.lighting ?? null),
          promptFields: (map.prompt as PromptFields | null) ?? null,
          audit: (map.audit as AuditData | null) ?? null,
        };
        dispatch({ type: "LOAD_SESSIONS", payload: [built] });
        dispatch({ type: "SET_ACTIVE_SESSION", payload: sid });
        const history = loadHistory();
        if (history.length > 0)
          dispatch({ type: "LOAD_HISTORY", payload: history });
        setHydrated(true);
      } catch (err) {
        console.warn("[visualize-shell] hydrate failed:", err);
        setHydrated(true); // open empty canvas as last resort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // History only stays in localStorage for now — kept for v2 parity.
  useEffect(() => {
    if (state.history.length > 0) saveHistory(state.history);
  }, [state.history]);

  // Mirror to Postgres via session_node_state.
  useEffect(() => {
    if (!session) return;
    const flush = async () => {
      const payload: Array<{ nodeId: NodeId; data: unknown }> = [
        { nodeId: "intent", data: session.intent ?? {} },
        { nodeId: "visualPriority", data: session.visualPriority ?? {} },
        { nodeId: "references", data: { breakdowns: session.referenceBreakdowns } },
        {
          nodeId: "geometry",
          data: session.geometryValidation ?? {},
        },
        {
          nodeId: "materialsLight",
          data: {
            materials: session.materialJustifications,
            lighting: session.lighting,
          },
        },
        { nodeId: "prompt", data: session.promptFields ?? {} },
        { nodeId: "audit", data: session.audit ?? {} },
      ];
      for (const p of payload) {
        await fetch(`/api/sessions/${sessionId}/state`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        }).catch(() => {});
      }
    };
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [session, sessionId]);

  useEffect(() => {
    if (state.activeSessionId && !drawerOpen) setDrawerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSessionId]);

  useEffect(() => {
    if (state.showExitSummary) setDrawerOpen(false);
  }, [state.showExitSummary]);

  const handleOpenDrawer = useCallback(
    (nodeId: NodeId) => {
      dispatch({ type: "SET_ACTIVE_NODE", payload: nodeId });
      setDrawerOpen(true);
    },
    [dispatch],
  );
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
  const showSessionList = !state.activeSessionId;

  if (!hydrated) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-stone-500">
        Loading session…
      </main>
    );
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="h-screen overflow-hidden flex flex-col pt-[52px]">
        <div className="absolute top-2 left-3 z-50 text-xs">
          <Link href={`/studio/${sessionId}`} className="text-stone-400 hover:text-white">
            ← Session
          </Link>
        </div>
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <LivingCanvas
            onOpenDrawer={handleOpenDrawer}
            onOpenRenderFullscreen={() => setRenderFullscreen(true)}
          />
        </main>
      </div>
      <FormDrawer
        open={drawerOpen || showSessionList}
        onClose={handleCloseDrawer}
        activeNode={state.activeNode}
        showSessionList={showSessionList}
      />
      <Nav
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDrawer={handleOpenDrawer}
        session={session}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {state.showExitSummary && <NodeExitSummary onContinue={handleOpenDrawer} />}
      {renderFullscreen && (
        <RenderResult mode="fullscreen" onClose={() => setRenderFullscreen(false)} />
      )}
    </AppContext.Provider>
  );
}

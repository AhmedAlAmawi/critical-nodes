/**
 * useSessionState — server-backed replacement for the v2 localStorage hook.
 *
 * Loads the full set of session_node_state rows once on mount, exposes a
 * `getNode<T>(nodeId)` accessor and a debounced `setNode(nodeId, data)`
 * mutator that PATCHes `/api/sessions/[id]/state`.
 *
 * The v2 components (intent-form, visual-priority-locator, …) keep working
 * because their data shapes (IntentData, VisualPriorityData, …) are
 * persisted verbatim into the `data` jsonb column. The repointing is the
 * persistence layer only.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NodeStateRow = {
  node_id: string;
  data: unknown;
  mentor_feedback: unknown;
  completed_at: string | null;
  updated_at: string;
};

type Loaded = {
  status: "loading" | "ready" | "error";
  session: { id: number; status: string; assignment_id: number | null } | null;
  states: Record<string, NodeStateRow>;
  error?: string;
};

export function useSessionState(sessionId: number) {
  const [loaded, setLoaded] = useState<Loaded>({
    status: "loading",
    session: null,
    states: {},
  });
  const flushTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingData = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          session: { id: number; status: string; assignment_id: number | null };
          states: NodeStateRow[];
        };
        if (cancelled) return;
        const map: Record<string, NodeStateRow> = {};
        for (const r of j.states) map[r.node_id] = r;
        setLoaded({ status: "ready", session: j.session, states: map });
      } catch (err) {
        if (cancelled) return;
        setLoaded({
          status: "error",
          session: null,
          states: {},
          error: (err as Error).message,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const getNode = useCallback(
    <T = unknown>(nodeId: string): T | null => {
      const row = loaded.states[nodeId];
      return (row?.data ?? null) as T | null;
    },
    [loaded],
  );

  const setNode = useCallback(
    (nodeId: string, data: unknown, opts?: { completed?: boolean }) => {
      pendingData.current.set(nodeId, data);
      // Optimistic local update.
      setLoaded((curr) => ({
        ...curr,
        states: {
          ...curr.states,
          [nodeId]: {
            node_id: nodeId,
            data,
            mentor_feedback: curr.states[nodeId]?.mentor_feedback ?? null,
            completed_at: opts?.completed
              ? new Date().toISOString()
              : curr.states[nodeId]?.completed_at ?? null,
            updated_at: new Date().toISOString(),
          },
        },
      }));

      // Debounced server flush per node.
      const prev = flushTimers.current.get(nodeId);
      if (prev) clearTimeout(prev);
      flushTimers.current.set(
        nodeId,
        setTimeout(async () => {
          const value = pendingData.current.get(nodeId);
          pendingData.current.delete(nodeId);
          try {
            await fetch(`/api/sessions/${sessionId}/state`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nodeId,
                data: value,
                completed: opts?.completed,
              }),
            });
          } catch (err) {
            console.warn(`[useSessionState] flush failed: ${(err as Error).message}`);
          }
        }, 400),
      );
    },
    [sessionId],
  );

  return useMemo(
    () => ({
      ...loaded,
      getNode,
      setNode,
    }),
    [loaded, getNode, setNode],
  );
}

/**
 * useSessionState — server-backed replacement for the v2 localStorage hook.
 *
 * Loads the full set of session_node_state rows once on mount, exposes a
 * `getNode<T>(nodeId)` accessor and a debounced `setNode(nodeId, data)`
 * mutator that PATCHes `/api/sessions/[id]/state`.
 *
 * `setNode` accepts either a full replacement value or an updater function
 * `(prev) => next`. Updaters are applied against the *latest* in-memory value
 * (including not-yet-flushed writes), so two rapid writes from stale React
 * closures can no longer clobber each other — this was the root cause of
 * Think/Reflect answers going missing in the phase runner.
 *
 * Flushes use `keepalive: true` and are force-flushed on `pagehide`, so a
 * student closing the tab right after typing still gets their answer saved.
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

type Updater<T> = (prev: T | null) => T;

const FLUSH_DEBOUNCE_MS = 400;

export function useSessionState(sessionId: number) {
  const [loaded, setLoaded] = useState<Loaded>({
    status: "loading",
    session: null,
    states: {},
  });

  // Latest known data per node — updated synchronously in setNode so that
  // back-to-back writes compose correctly regardless of render timing.
  const latestData = useRef<Map<string, unknown>>(new Map());
  const flushTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pending = useRef<
    Map<string, { data: unknown; completed?: boolean }>
  >(new Map());

  const flushNode = useCallback(
    async (nodeId: string, keepalive = false) => {
      const timer = flushTimers.current.get(nodeId);
      if (timer) {
        clearTimeout(timer);
        flushTimers.current.delete(nodeId);
      }
      const entry = pending.current.get(nodeId);
      if (!entry) return;
      pending.current.delete(nodeId);
      try {
        await fetch(`/api/sessions/${sessionId}/state`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId,
            data: entry.data,
            completed: entry.completed,
          }),
          keepalive,
        });
      } catch (err) {
        console.warn(
          `[useSessionState] flush failed for ${nodeId}: ${(err as Error).message}`,
        );
        // Re-queue so a later write (or pagehide) retries it.
        if (!pending.current.has(nodeId)) pending.current.set(nodeId, entry);
      }
    },
    [sessionId],
  );

  const flushAll = useCallback(
    (keepalive = false) => {
      for (const nodeId of Array.from(pending.current.keys())) {
        void flushNode(nodeId, keepalive);
      }
    },
    [flushNode],
  );

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
        for (const r of j.states) {
          map[r.node_id] = r;
          if (!latestData.current.has(r.node_id)) {
            latestData.current.set(r.node_id, r.data);
          }
        }
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

  // Force-flush anything pending when the page is being hidden / closed.
  useEffect(() => {
    const onHide = () => flushAll(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => {
      window.removeEventListener("pagehide", onHide);
    };
  }, [flushAll]);

  const getNode = useCallback(
    <T = unknown>(nodeId: string): T | null => {
      const row = loaded.states[nodeId];
      return (row?.data ?? null) as T | null;
    },
    [loaded],
  );

  const setNode = useCallback(
    <T = unknown>(
      nodeId: string,
      dataOrUpdater: T | Updater<T>,
      opts?: { completed?: boolean },
    ) => {
      const prev = (latestData.current.get(nodeId) ?? null) as T | null;
      const next =
        typeof dataOrUpdater === "function"
          ? (dataOrUpdater as Updater<T>)(prev)
          : dataOrUpdater;
      latestData.current.set(nodeId, next);

      const prevPending = pending.current.get(nodeId);
      pending.current.set(nodeId, {
        data: next,
        completed: opts?.completed || prevPending?.completed,
      });

      // Optimistic local update.
      setLoaded((curr) => ({
        ...curr,
        states: {
          ...curr.states,
          [nodeId]: {
            node_id: nodeId,
            data: next,
            mentor_feedback: curr.states[nodeId]?.mentor_feedback ?? null,
            completed_at: opts?.completed
              ? new Date().toISOString()
              : (curr.states[nodeId]?.completed_at ?? null),
            updated_at: new Date().toISOString(),
          },
        },
      }));

      // Debounced server flush per node.
      const prevTimer = flushTimers.current.get(nodeId);
      if (prevTimer) clearTimeout(prevTimer);
      flushTimers.current.set(
        nodeId,
        setTimeout(() => void flushNode(nodeId), FLUSH_DEBOUNCE_MS),
      );
    },
    [flushNode],
  );

  return useMemo(
    () => ({
      ...loaded,
      getNode,
      setNode,
      flushAll,
    }),
    [loaded, getNode, setNode, flushAll],
  );
}

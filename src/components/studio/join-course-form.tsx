"use client";

/**
 * Join a course by code. Accepts `?join=CODE` in the URL (the link faculty
 * share) and submits it automatically.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function JoinCourseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prefill = params.get("join") ?? "";
  const [code, setCode] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const autoFired = useRef(false);

  async function join(c: string) {
    if (!c.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/courses/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; course?: { title: string }; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg({ tone: "ok", text: `Joined ${j.course?.title ?? "course"}.` });
      setCode("");
      router.replace("/studio");
      router.refresh();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (prefill && !autoFired.current) {
      autoFired.current = true;
      void join(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void join(code);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Course code from your instructor"
        className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none w-64"
      />
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:border-stone-900 disabled:opacity-40"
      >
        {busy ? "Joining…" : "Join course"}
      </button>
      {msg && (
        <span className={`text-xs ${msg.tone === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>
      )}
    </form>
  );
}

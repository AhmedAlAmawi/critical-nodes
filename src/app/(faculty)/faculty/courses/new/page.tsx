"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, code: code || undefined }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed: ${res.status}`);
      }
      const j = (await res.json()) as { course: { id: number } };
      router.push(`/faculty/courses/${j.course.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-stone-500">Faculty</p>
        <h1 className="text-3xl font-serif mt-1">New course</h1>
      </header>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-widest text-stone-500">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Interior Design Studio III"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-widest text-stone-500">
            Course code (optional)
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ARCH-301"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading || !title.trim()}
          className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Creating…" : "Create course"}
        </button>
      </div>
    </main>
  );
}

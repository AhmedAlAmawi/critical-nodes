"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelectRoleForm() {
  const router = useRouter();
  const [role, setRole] = useState<"faculty" | "student">("student");
  const [instructorCode, setInstructorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, instructorCode }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed: ${res.status}`);
      }
      router.push(role === "faculty" ? "/faculty" : "/studio");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      <header className="space-y-1">
        <h1 className="text-2xl font-serif">Welcome</h1>
        <p className="text-sm text-stone-600">
          Are you joining as faculty or student? You can only pick once.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {(["faculty", "student"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              role === r
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            {r === "faculty" ? "Faculty" : "Student"}
          </button>
        ))}
      </div>

      {role === "faculty" && (
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-widest text-stone-500">
            Instructor code
          </span>
          <input
            type="text"
            value={instructorCode}
            onChange={(e) => setInstructorCode(e.target.value)}
            placeholder="Provided by your institution"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          />
        </label>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || (role === "faculty" && !instructorCode.trim())}
        className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

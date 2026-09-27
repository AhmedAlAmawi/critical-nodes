"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-stone-500 w-20 flex-shrink-0">{label}</span>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 sm:w-80 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 font-mono text-[11px] text-stone-700"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] hover:border-stone-900"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </label>
  );
}

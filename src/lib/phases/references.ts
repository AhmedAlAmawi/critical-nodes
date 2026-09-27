/**
 * Academic reference resolution for the phase runner + receipt.
 *
 * Malzama attributes every insight and mission to "Title — Author" resolved
 * from its reference library; the raw `referenceId` was never shown to
 * students. This keeps that behaviour.
 */

import refs from "@/config/references-academic.json";

type Ref = { title: string; author: string; focus: string };

const LIBRARY = refs as Record<string, Ref>;

export function referenceLabel(referenceId: string | null | undefined): string {
  if (!referenceId) return "";
  const r = LIBRARY[referenceId];
  return r ? `${r.title} — ${r.author}` : referenceId;
}

export function referenceEntry(referenceId: string): Ref | null {
  return LIBRARY[referenceId] ?? null;
}

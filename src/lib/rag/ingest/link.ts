/**
 * Link ingestion — phase 1 (fetch HTML, strip tags, chunk, insert).
 *
 * Embedding is handled by the shared `/api/ingest/[id]/embed` loop
 * (embed-missing.ts), same as PDFs. Image extraction deferred.
 */

import "server-only";
import { insertChunk } from "../db";
import { chunkText, markError, setIngestStatus } from "./_common";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function naiveStripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export async function ingestLink(args: {
  sourceId: number;
  url: string;
}): Promise<{ chunkCount: number }> {
  await setIngestStatus(args.sourceId, "running");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(args.url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    const text = naiveStripHtml(html);
    const parts = chunkText(text);
    if (parts.length === 0) {
      throw new Error("No readable text found at that URL.");
    }
    for (let i = 0; i < parts.length; i++) {
      await insertChunk({
        sourceId: args.sourceId,
        ordinal: i,
        kind: "text",
        contentText: parts[i].text,
        tokens: parts[i].tokens,
      });
    }
    // Status stays 'running' until the embed loop finishes.
    return { chunkCount: parts.length };
  } catch (err) {
    await markError(args.sourceId, (err as Error).message);
    throw err;
  }
}

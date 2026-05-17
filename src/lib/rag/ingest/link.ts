/**
 * Link ingestion: fetch HTML, naive readability (strip tags), embed text
 * chunks. Image extraction deferred to a follow-up pass.
 */

import "server-only";
import { embedTextsBatch } from "../embed";
import { insertChunk } from "../db";
import { chunkText, markError, setIngestStatus } from "./_common";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function naiveStripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function ingestLink(args: {
  sourceId: number;
  url: string;
}): Promise<{ chunkCount: number }> {
  await setIngestStatus(args.sourceId, "running");
  try {
    const res = await fetch(args.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    const text = naiveStripHtml(html);
    const parts = chunkText(text);
    const BATCH = 8;
    let inserted = 0;
    for (let i = 0; i < parts.length; i += BATCH) {
      const slice = parts.slice(i, i + BATCH);
      let vectors: Array<Float32Array | null>;
      try {
        vectors = await embedTextsBatch(slice.map((p) => p.text));
      } catch {
        vectors = slice.map(() => null);
      }
      for (let j = 0; j < slice.length; j++) {
        const p = slice[j];
        await insertChunk({
          sourceId: args.sourceId,
          ordinal: i + j,
          kind: "text",
          contentText: p.text,
          tokens: p.tokens,
          embedding: vectors[j] ?? undefined,
        });
        inserted++;
      }
    }
    await setIngestStatus(args.sourceId, "done");
    return { chunkCount: inserted };
  } catch (err) {
    await markError(args.sourceId, (err as Error).message);
    throw err;
  }
}

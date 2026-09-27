/**
 * PDF ingestion — phase 1 (extract + chunk + insert).
 *
 * Per §8 of critical-nodes-v3.md:
 *   1. unpdf: extract per-page text
 *   2. one synthetic page-level "image" chunk per page (content_text = the
 *      page's text) so the chunk graph is uniform; real rasters can be
 *      backfilled later without touching callers
 *   3. heading-aware text splitter → text chunks (~500 tokens, 80 overlap)
 *
 * Embedding is NOT done here. Rows are inserted without vectors and the
 * `/api/ingest/[id]/embed` loop (see embed-missing.ts) fills them in. This
 * keeps the upload request short (seconds, not minutes) and makes the whole
 * pipeline resumable on serverless.
 */

import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { insertChunk } from "../db";
import { chunkText, markError, setIngestStatus, setPageCount } from "./_common";

export type IngestProgress = (msg: string) => void;

export function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF" — allow a little leading junk (some exporters prepend a BOM/newline).
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF");
}

export async function ingestPdf(args: {
  sourceId: number;
  data: Uint8Array;
  progress?: IngestProgress;
}): Promise<{ chunkCount: number; pageCount: number }> {
  const log = args.progress ?? (() => {});
  await setIngestStatus(args.sourceId, "running");
  try {
    if (!looksLikePdf(args.data)) {
      throw new Error("This file is not a PDF. Export it as PDF and upload again.");
    }

    log("loading PDF");
    const doc = await getDocumentProxy(args.data);
    const pageCount = doc.numPages;
    await setPageCount(args.sourceId, pageCount);
    log(`PDF has ${pageCount} pages`);

    // 1. Per-page text extraction (unpdf returns string[] with mergePages=false).
    const { text } = await extractText(args.data, { mergePages: false });
    const perPageText: string[] = Array.isArray(text) ? (text as string[]) : [String(text)];

    // 2. Build chunk plan: per-page placeholder + text sub-chunks.
    type Plan = { kind: "text" | "image"; page: number; text: string; tokens: number };
    const plan: Plan[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = i + 1;
      const txt = (perPageText[i] ?? "").trim();
      if (!txt) continue; // blank / image-only page: nothing to index yet
      plan.push({
        kind: "image",
        page,
        text: txt.slice(0, 1200),
        tokens: Math.ceil(Math.min(txt.length, 1200) / 4),
      });
      for (const part of chunkText(txt, { targetTokens: 500, overlapTokens: 80 })) {
        plan.push({ kind: "text", page, text: part.text, tokens: part.tokens });
      }
    }
    log(`built plan: ${plan.length} chunks`);

    if (plan.length === 0) {
      throw new Error(
        "No extractable text found — this PDF looks like scanned images. OCR it (or export from the source document) and upload again.",
      );
    }

    // 3. Insert rows (no vectors yet).
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      await insertChunk({
        sourceId: args.sourceId,
        ordinal: i,
        kind: p.kind,
        page: p.page,
        contentText: p.text,
        tokens: p.tokens,
      });
    }
    log(`inserted ${plan.length} chunks across ${pageCount} pages; embedding pending`);
    // Status stays 'running' until the embed loop reports remaining === 0.
    return { chunkCount: plan.length, pageCount };
  } catch (err) {
    const msg = (err as Error).message;
    await markError(args.sourceId, msg);
    throw err;
  }
}

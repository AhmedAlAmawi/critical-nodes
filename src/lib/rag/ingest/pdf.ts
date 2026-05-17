/**
 * PDF ingestion pipeline.
 *
 * Per §8 of critical-nodes-v3.md:
 *   1. unpdf: extract per-page text
 *   2. (deferred) per-page raster to 512px JPEG → image chunks
 *      (pdfjs-dist render is server-heavy; we record one synthetic image-chunk
 *      placeholder per page so the chunk-graph is uniform; future pass can
 *      backfill real rasters via a background job)
 *   3. heading-aware text splitter → text chunks (~400-600 tokens, 80 overlap)
 *   4. (deferred until GEMINI_API_KEY is wired) figure detection per page
 *
 * Embedding happens at the end in batches of 8 with the embed.ts rate-limit
 * posture. Status is updated on `sources` as we go.
 *
 * NOTE: PDF.js page rasterization on Vercel Functions is non-trivial (canvas
 * polyfill); for the MVP we ingest text + page placeholders, and a later
 * pass can attach real raster URLs once the worker pipeline is set up.
 */

import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { embedTextsBatch } from "../embed";
import { insertChunk } from "../db";
import {
  chunkText,
  markError,
  setIngestStatus,
  setPageCount,
} from "./_common";

export type IngestProgress = (msg: string) => void;

export async function ingestPdf(args: {
  sourceId: number;
  data: Uint8Array;
  progress?: IngestProgress;
}): Promise<{ chunkCount: number; pageCount: number }> {
  const log = args.progress ?? (() => {});
  await setIngestStatus(args.sourceId, "running");
  try {
    log("loading PDF");
    const doc = await getDocumentProxy(args.data);
    const pageCount = doc.numPages;
    await setPageCount(args.sourceId, pageCount);
    log(`PDF has ${pageCount} pages`);

    // 1. Per-page text extraction.
    const perPageText: string[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const { text } = await extractText(args.data, { mergePages: false });
      if (Array.isArray(text)) {
        // unpdf returns an array of per-page strings when mergePages=false
        perPageText.push(...(text as string[]));
        break; // extractText already returned all pages
      } else {
        perPageText.push(text as string);
      }
    }

    // 2. Build chunk plan: per-page placeholder image + text chunks.
    type Plan = {
      kind: "text" | "image";
      page: number;
      text: string;
      tokens: number;
    };
    const plan: Plan[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = i + 1;
      const txt = perPageText[i] ?? "";
      // Page-level image placeholder. content_text stores the page's full text
      // so the multimodal model gets a usable representation even before raster.
      plan.push({
        kind: "image",
        page,
        text: txt.slice(0, 1200),
        tokens: Math.ceil(Math.min(txt.length, 1200) / 4),
      });
      // Text sub-chunks.
      const parts = chunkText(txt, { targetTokens: 500, overlapTokens: 80 });
      for (const part of parts) {
        plan.push({ kind: "text", page, text: part.text, tokens: part.tokens });
      }
    }

    log(`built plan: ${plan.length} chunks`);

    // 3. Embed in batches and insert.
    const BATCH = 8;
    let inserted = 0;
    for (let i = 0; i < plan.length; i += BATCH) {
      const slice = plan.slice(i, i + BATCH);
      let vectors: Array<Float32Array | null>;
      try {
        vectors = await embedTextsBatch(slice.map((p) => p.text || " "));
      } catch (err) {
        log(`embed batch failed: ${(err as Error).message}`);
        vectors = slice.map(() => null);
      }
      for (let j = 0; j < slice.length; j++) {
        const p = slice[j];
        const v = vectors[j];
        await insertChunk({
          sourceId: args.sourceId,
          ordinal: i + j,
          kind: p.kind,
          page: p.page,
          contentText: p.text,
          tokens: p.tokens,
          embedding: v ?? undefined,
        });
        inserted++;
      }
      log(`upserted ${Math.min(i + BATCH, plan.length)}/${plan.length}`);
    }

    await setIngestStatus(args.sourceId, "done");
    log(`done: ${inserted} chunks across ${pageCount} pages`);
    return { chunkCount: inserted, pageCount };
  } catch (err) {
    const msg = (err as Error).message;
    await markError(args.sourceId, msg);
    throw err;
  }
}

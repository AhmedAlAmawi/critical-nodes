/**
 * Top-level retrieve(query, options) — the public entry point for every
 * AI moment in v3.
 *
 * Mirrors spec-studio's /api/match orchestration in route.ts:
 *   embed query → ANN with overscan → filter by scope → auto-relax on empty →
 *   re-rank → return RetrieveResult with timingMs.
 */

import "server-only";
import { embedText, embedImageBuffer } from "./embed";
import { searchByEmbedding, searchByText } from "./db";
import { rerank, type QueryInput } from "./rerank";
import type { RankedChunk, RetrieveOptions, RetrieveResult } from "./types";

export type RetrieveQuery =
  | { kind: "text"; text: string }
  | { kind: "image"; buffer: Buffer; mime: string };

export async function retrieve(
  query: RetrieveQuery,
  opts: RetrieveOptions,
): Promise<RetrieveResult> {
  const t0 = Date.now();
  const k = opts.k ?? 24;
  const overscanMultiple = opts.overscanMultiple ?? 4;

  // 1. Embed the query.
  const tEmbed = Date.now();
  let qVec: Float32Array;
  if (query.kind === "text") {
    qVec = await embedText(query.text);
  } else {
    qVec = await embedImageBuffer(query.buffer, query.mime);
  }
  const embedMs = Date.now() - tEmbed;

  // 2. ANN search with scope filter applied post-fetch.
  const tAnn = Date.now();
  let vecHits = await searchByEmbedding({
    query: qVec,
    courseId: opts.courseId,
    sourceIds: opts.sourceIds,
    chunkIds: opts.chunkIds,
    k,
    overscanMultiple,
  });

  // Optional FTS union for short text queries.
  let unioned: RankedChunk[] = vecHits;
  if (query.kind === "text" && opts.hybridFts && query.text.trim().split(/\s+/).length <= 6) {
    const ftsHits = await searchByText({
      query: query.text,
      courseId: opts.courseId,
      k,
    });
    const byId = new Map<number, RankedChunk>();
    for (const h of vecHits) byId.set(h.id, h);
    for (const h of ftsHits) if (!byId.has(h.id)) byId.set(h.id, h);
    unioned = Array.from(byId.values()).slice(0, k);
  }

  // 3. Auto-relax on empty when scope is set (spec-studio §7 invariant).
  let relaxedFilter = false;
  if (
    unioned.length === 0 &&
    ((opts.sourceIds && opts.sourceIds.length > 0) ||
      (opts.chunkIds && opts.chunkIds.length > 0))
  ) {
    unioned = await searchByEmbedding({
      query: qVec,
      courseId: opts.courseId,
      k,
      overscanMultiple,
    });
    relaxedFilter = unioned.length > 0;
  }
  const annMs = Date.now() - tAnn;

  // 4. Re-rank.
  const tRerank = Date.now();
  const queryForRerank: QueryInput =
    query.kind === "text"
      ? { kind: "text", text: query.text }
      : { kind: "image", buffer: query.buffer, mime: query.mime };
  const ranked = await rerank(queryForRerank, unioned, Math.min(k, 8));
  const rerankMs = Date.now() - tRerank;

  return {
    hits: ranked,
    relaxedFilter,
    timingMs: {
      embed: embedMs,
      ann: annMs,
      rerank: rerankMs,
      total: Date.now() - t0,
    },
  };
}

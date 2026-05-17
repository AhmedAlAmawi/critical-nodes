/**
 * Shared types for the RAG kernel.
 *
 * Generalization of spec-studio/lib/types.ts: vendor→course-scope, product→
 * source_chunk, multimodal in/out preserved.
 */

export type ChunkKind = "text" | "image" | "table";

export type Chunk = {
  id: number;
  sourceId: number;
  parentChunkId: number | null;
  ordinal: number;
  kind: ChunkKind;
  page: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
  contentText: string | null;
  imageBlobUrl: string | null;
  tokens: number | null;
  /** Joined for convenience in retrieval results. */
  sourceTitle?: string;
};

export type RankedChunk = Chunk & {
  /** cosine similarity in [0, 1]; higher = closer */
  similarity: number;
  /** 1-based rank after re-rank; defaults to vector rank when re-rank skipped */
  rerankRank: number;
  /** one-line "why this match" from the re-ranker; empty on fallback */
  reason: string;
};

export type RetrieveOptions = {
  courseId: number;
  /** If set, restrict candidates to chunks belonging to these sources. */
  sourceIds?: number[];
  /** If set (typically from `assignment.scope_chunk_ids`), restrict further. */
  chunkIds?: number[];
  /** Top-K to keep AFTER filter. Default 24. */
  k?: number;
  /** ANN candidate overscan factor (k * overscanMultiple). Default 4. */
  overscanMultiple?: number;
  /** When true, also union with full-text search results for short queries. */
  hybridFts?: boolean;
};

export type RetrieveResult = {
  hits: RankedChunk[];
  /** True when scope filter returned 0 and we relaxed it. */
  relaxedFilter: boolean;
  timingMs: { embed: number; ann: number; rerank: number; total: number };
};

export type Citation = {
  chunkId: number;
  sourceId: number;
  page: number | null;
  sourceTitle?: string;
};

export type GroundedResponse<TBody> = {
  /** Whatever the AI returned (already parsed against the schema). */
  body: TBody;
  /** Validated subset of the chunks that were actually retrievable. */
  citations: Citation[];
  /** When true, the AI step failed and we fell back to a template/identity path. */
  fallback: boolean;
  /** ms spent in each sub-step. */
  timingMs: { retrieve: number; ground: number; total: number };
};

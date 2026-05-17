/**
 * Postgres + pgvector wrappers — analogue of spec-studio/lib/db.ts.
 *
 * Uses the Neon HTTP driver via @neondatabase/serverless. The drizzle ORM
 * is great for the rest of the app, but ANN search uses parameterized raw
 * SQL because pgvector's `<=>` operator and bigint[] cast are easiest to
 * express that way.
 */

import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Chunk, RankedChunk } from "./types";

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    throw new Error("DATABASE_URL missing");
  }
  _sql = neon(url);
  return _sql;
}

/** Float32Array -> pgvector literal "[v1,v2,...]". */
export function vecLiteral(v: Float32Array | number[]): string {
  const arr = v instanceof Float32Array ? Array.from(v) : v;
  return `[${arr.join(",")}]`;
}

/**
 * Insert or replace a chunk row + its vector. Returns the chunk id.
 *
 * Generalizes spec-studio's upsertProduct(): no ON CONFLICT here because
 * source_chunks has no natural unique key, but you can call replaceVector()
 * to swap an embedding for an existing chunk_id (used by ingest re-runs).
 */
export async function insertChunk(args: {
  sourceId: number;
  parentChunkId?: number | null;
  ordinal: number;
  kind: "text" | "image" | "table";
  page?: number | null;
  bbox?: object | null;
  contentText?: string | null;
  imageBlobUrl?: string | null;
  tokens?: number | null;
  embedding?: Float32Array | number[] | null;
}): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO source_chunks
      (source_id, parent_chunk_id, ordinal, kind, page, bbox, content_text, image_blob_url, tokens)
    VALUES
      (${args.sourceId}, ${args.parentChunkId ?? null}, ${args.ordinal}, ${args.kind},
       ${args.page ?? null}, ${args.bbox ? JSON.stringify(args.bbox) : null}::jsonb,
       ${args.contentText ?? null}, ${args.imageBlobUrl ?? null}, ${args.tokens ?? null})
    RETURNING id
  `) as Array<{ id: number }>;
  const id = Number(rows[0].id);
  if (args.embedding) {
    await sql`
      INSERT INTO source_chunk_vec (chunk_id, embedding)
      VALUES (${id}, ${vecLiteral(args.embedding)}::vector)
      ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding
    `;
  }
  return id;
}

export async function replaceVector(
  chunkId: number,
  embedding: Float32Array | number[],
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO source_chunk_vec (chunk_id, embedding)
    VALUES (${chunkId}, ${vecLiteral(embedding)}::vector)
    ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding
  `;
}

type AnnRow = {
  id: number | string;
  source_id: number | string;
  parent_chunk_id: number | string | null;
  ordinal: number;
  kind: "text" | "image" | "table";
  page: number | null;
  bbox: object | null;
  content_text: string | null;
  image_blob_url: string | null;
  tokens: number | null;
  source_title: string;
  course_id: number | string;
  distance: number;
};

/**
 * Vector ANN search via pgvector cosine distance.
 *
 * Overscan-then-filter: ask for `overscan` candidates, then filter by
 * course_id, sourceIds, chunkIds in JS and slice to k. Mirrors spec-studio's
 * pattern in searchByEmbedding() — keeps the SQL simple and lets us add
 * post-filters without complicating the index.
 */
export async function searchByEmbedding(args: {
  query: Float32Array | number[];
  courseId: number;
  sourceIds?: number[];
  chunkIds?: number[];
  k?: number;
  overscanMultiple?: number;
}): Promise<RankedChunk[]> {
  const sql = getSql();
  const k = args.k ?? 24;
  const overscan = Math.max(k * (args.overscanMultiple ?? 4), 60);
  const qLit = vecLiteral(args.query);

  const rows = (await sql`
    SELECT
      c.id, c.source_id, c.parent_chunk_id, c.ordinal, c.kind, c.page, c.bbox,
      c.content_text, c.image_blob_url, c.tokens,
      s.title AS source_title,
      s.course_id,
      (v.embedding <=> ${qLit}::vector) AS distance
    FROM source_chunk_vec v
    JOIN source_chunks c ON c.id = v.chunk_id
    JOIN sources s ON s.id = c.source_id
    WHERE s.course_id = ${args.courseId}
    ORDER BY v.embedding <=> ${qLit}::vector
    LIMIT ${overscan}
  `) as unknown as AnnRow[];

  let filtered = rows;
  if (args.sourceIds && args.sourceIds.length > 0) {
    const allow = new Set(args.sourceIds.map(Number));
    filtered = filtered.filter((r) => allow.has(Number(r.source_id)));
  }
  if (args.chunkIds && args.chunkIds.length > 0) {
    const allow = new Set(args.chunkIds.map(Number));
    filtered = filtered.filter((r) => allow.has(Number(r.id)));
  }

  return filtered.slice(0, k).map((r, i) => ({
    id: Number(r.id),
    sourceId: Number(r.source_id),
    parentChunkId: r.parent_chunk_id == null ? null : Number(r.parent_chunk_id),
    ordinal: r.ordinal,
    kind: r.kind,
    page: r.page,
    bbox: r.bbox as Chunk["bbox"],
    contentText: r.content_text,
    imageBlobUrl: r.image_blob_url,
    tokens: r.tokens,
    sourceTitle: r.source_title,
    similarity: clamp01(1 - Number(r.distance)),
    rerankRank: i + 1,
    reason: "",
  }));
}

/**
 * Full-text search union for short queries (≤6 tokens). Returns chunks that
 * match the query via Postgres tsvector; the caller is expected to union
 * with vector hits and dedupe by id before re-rank.
 */
export async function searchByText(args: {
  query: string;
  courseId: number;
  k?: number;
}): Promise<RankedChunk[]> {
  const sql = getSql();
  const k = args.k ?? 24;
  const rows = (await sql`
    SELECT
      c.id, c.source_id, c.parent_chunk_id, c.ordinal, c.kind, c.page, c.bbox,
      c.content_text, c.image_blob_url, c.tokens,
      s.title AS source_title,
      s.course_id,
      ts_rank_cd(to_tsvector('english', coalesce(c.content_text,'')),
                 websearch_to_tsquery('english', ${args.query})) AS rank
    FROM source_chunks c
    JOIN sources s ON s.id = c.source_id
    WHERE s.course_id = ${args.courseId}
      AND to_tsvector('english', coalesce(c.content_text,'')) @@
          websearch_to_tsquery('english', ${args.query})
    ORDER BY rank DESC
    LIMIT ${k}
  `) as unknown as Array<AnnRow & { rank: number }>;

  return rows.map((r, i) => ({
    id: Number(r.id),
    sourceId: Number(r.source_id),
    parentChunkId: r.parent_chunk_id == null ? null : Number(r.parent_chunk_id),
    ordinal: r.ordinal,
    kind: r.kind,
    page: r.page,
    bbox: r.bbox as Chunk["bbox"],
    contentText: r.content_text,
    imageBlobUrl: r.image_blob_url,
    tokens: r.tokens,
    sourceTitle: r.source_title,
    similarity: 0, // FTS doesn't yield cosine similarity
    rerankRank: i + 1,
    reason: "",
  }));
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

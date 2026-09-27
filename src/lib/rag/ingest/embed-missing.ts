/**
 * Phase 2 of ingestion: embed chunks that don't have a vector yet.
 *
 * Ingestion is split in two so it survives serverless execution limits:
 *   1. `ingestPdf` / `ingestLink` extract + chunk + INSERT rows (fast, awaited)
 *   2. this function embeds a bounded slice of un-vectored chunks per call
 *
 * The faculty UI (and the Resume button) calls `/api/ingest/[id]/embed` in a
 * loop until `remaining === 0`. Each call is idempotent — a crashed or
 * timed-out call just leaves a few chunks un-embedded for the next call.
 * This is the same posture as spec-studio's `ingest --embed-missing`.
 */

import "server-only";
import { neon } from "@neondatabase/serverless";
import { embedImageUrlsBatch, embedTextsBatch, EMBED_CHUNKS_PER_CALL } from "../embed";
import { replaceVector } from "../db";
import { setIngestStatus } from "./_common";

type MissingRow = {
  id: number | string;
  kind: "text" | "image" | "table";
  content_text: string | null;
  image_blob_url: string | null;
};

export type EmbedProgress = {
  sourceId: number;
  embedded: number;
  failed: number;
  remaining: number;
  total: number;
  status: "running" | "done" | "error";
};

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL missing");
  return neon(url);
}

export async function countChunks(sourceId: number): Promise<{
  total: number;
  embedded: number;
}> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      (SELECT COUNT(*) FROM source_chunks WHERE source_id = ${sourceId}) AS total,
      (SELECT COUNT(*) FROM source_chunks c
         JOIN source_chunk_vec v ON v.chunk_id = c.id
        WHERE c.source_id = ${sourceId}) AS embedded
  `) as Array<{ total: number | string; embedded: number | string }>;
  return { total: Number(rows[0]?.total ?? 0), embedded: Number(rows[0]?.embedded ?? 0) };
}

export async function embedMissingChunks(
  sourceId: number,
  limit: number = EMBED_CHUNKS_PER_CALL,
): Promise<EmbedProgress> {
  const sql = getSql();

  const rows = (await sql`
    SELECT c.id, c.kind, c.content_text, c.image_blob_url
    FROM source_chunks c
    LEFT JOIN source_chunk_vec v ON v.chunk_id = c.id
    WHERE c.source_id = ${sourceId} AND v.chunk_id IS NULL
    ORDER BY c.ordinal
    LIMIT ${limit}
  `) as unknown as MissingRow[];

  let embedded = 0;
  let failed = 0;

  if (rows.length > 0) {
    // Text-representable chunks (text chunks + page placeholders) embed as text;
    // pure image chunks embed by URL.
    const textRows = rows.filter((r) => (r.content_text ?? "").trim().length > 0 || !r.image_blob_url);
    const imageRows = rows.filter((r) => !textRows.includes(r) && r.image_blob_url);

    if (textRows.length > 0) {
      try {
        const vecs = await embedTextsBatch(textRows.map((r) => (r.content_text ?? "").trim() || " "));
        for (let i = 0; i < textRows.length; i++) {
          const v = vecs[i];
          if (!v) {
            failed++;
            continue;
          }
          await replaceVector(Number(textRows[i].id), v);
          embedded++;
        }
      } catch (err) {
        failed += textRows.length;
        console.warn(`[embed-missing ${sourceId}] text batch failed: ${(err as Error).message}`);
      }
    }
    if (imageRows.length > 0) {
      try {
        const vecs = await embedImageUrlsBatch(imageRows.map((r) => r.image_blob_url!));
        for (let i = 0; i < imageRows.length; i++) {
          const v = vecs[i];
          if (!v) {
            failed++;
            continue;
          }
          await replaceVector(Number(imageRows[i].id), v);
          embedded++;
        }
      } catch (err) {
        failed += imageRows.length;
        console.warn(`[embed-missing ${sourceId}] image batch failed: ${(err as Error).message}`);
      }
    }
  }

  const counts = await countChunks(sourceId);
  const remaining = counts.total - counts.embedded;

  let status: EmbedProgress["status"] = "running";
  if (remaining === 0 && counts.total > 0) {
    await setIngestStatus(sourceId, "done");
    status = "done";
  } else if (rows.length > 0 && embedded === 0 && failed > 0) {
    // Nothing progressed this call — surface as error but leave the rows so a
    // Resume can retry once the upstream (Jina) recovers.
    await setIngestStatus(sourceId, "error", "Embedding provider unavailable — press Resume to retry.");
    status = "error";
  } else {
    await setIngestStatus(sourceId, "running");
  }

  return {
    sourceId,
    embedded,
    failed,
    remaining,
    total: counts.total,
    status,
  };
}

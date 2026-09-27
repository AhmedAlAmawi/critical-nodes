/**
 * Shared ingestion utilities — analogue of spec-studio/scripts/vendors/_common.ts.
 */

import "server-only";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";

let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL missing");
  _sql = neon(url);
  return _sql;
}

export async function setIngestStatus(
  sourceId: number,
  status: "queued" | "running" | "done" | "error",
  error?: string | null,
) {
  const sql = getSql();
  if (status === "done") {
    await sql`
      UPDATE sources
      SET ingest_status = ${status}, ingested_at = now(), ingest_error = ${error ?? null}
      WHERE id = ${sourceId}
    `;
  } else {
    await sql`
      UPDATE sources
      SET ingest_status = ${status}, ingest_error = ${error ?? null}
      WHERE id = ${sourceId}
    `;
  }
}

export async function setPageCount(sourceId: number, count: number) {
  const sql = getSql();
  await sql`UPDATE sources SET page_count = ${count} WHERE id = ${sourceId}`;
}

/** Upload bytes to Vercel Blob, return the public URL. */
export async function uploadBlob(
  pathname: string,
  buf: Buffer | Uint8Array,
  contentType = "image/jpeg",
): Promise<string> {
  const body = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const blob = await put(pathname, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Heading-aware text splitter. Targets ~400-600 token chunks with ~80-token
 * overlap. Token count approximated as Math.ceil(len/4).
 *
 * The splitter prefers paragraph and heading boundaries. Falls back to a
 * length-based split when no boundaries are within range.
 */
export function chunkText(
  full: string,
  opts: { targetTokens?: number; overlapTokens?: number } = {},
): Array<{ text: string; tokens: number }> {
  const targetTokens = opts.targetTokens ?? 500;
  const overlapTokens = opts.overlapTokens ?? 80;
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  const cleaned = full
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return [];
  if (cleaned.length <= targetChars) {
    return [{ text: cleaned, tokens: Math.ceil(cleaned.length / 4) }];
  }

  // Try splitting on paragraph boundaries (\n\n), then sentence breaks (. !).
  const out: Array<{ text: string; tokens: number }> = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + targetChars, cleaned.length);
    let cut = end;
    if (end < cleaned.length) {
      const window = cleaned.slice(i, end);
      // prefer paragraph
      const para = window.lastIndexOf("\n\n");
      if (para > targetChars * 0.5) {
        cut = i + para + 2;
      } else {
        // prefer sentence
        const m = /[.!?]\s+(?=[A-Z])/g;
        let lastSentence = -1;
        let r: RegExpExecArray | null;
        while ((r = m.exec(window))) lastSentence = r.index + r[0].length;
        if (lastSentence > targetChars * 0.5) {
          cut = i + lastSentence;
        }
      }
    }
    const piece = cleaned.slice(i, cut).trim();
    if (piece) out.push({ text: piece, tokens: Math.ceil(piece.length / 4) });
    if (cut >= cleaned.length) break;
    i = Math.max(cut - overlapChars, i + 1);
  }
  return out;
}

/** Mark a source error with a short string. */
export async function markError(sourceId: number, msg: string) {
  await setIngestStatus(sourceId, "error", msg.slice(0, 500));
}

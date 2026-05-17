/**
 * Gemini 2.5 Flash multimodal re-rank — port of spec-studio/lib/rerank.ts.
 *
 * Given a QUERY (text or image bytes) and up to N CANDIDATE chunks, ask
 * Gemini to rank them by pedagogical fit and write a 14-word reason per chunk.
 *
 * Strict JSON output. Falls back to identity ordering with empty reasons if
 * the API fails or returns unparseable JSON — student always sees results.
 */

import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { RankedChunk } from "./types";

const MODEL = "gemini-2.5-flash";
const MAX_CANDIDATES = 12;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY missing. https://aistudio.google.com/apikey",
    );
  }
  _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

const PROMPT = `You are an academic research assistant. A student is working through a design phase and asked the QUERY below. Below are CANDIDATE chunks from faculty-curated sources.

Evaluate each CANDIDATE on:
- direct relevance to the query (most important)
- specificity (concrete content beats general summaries)
- pedagogical value for a design student at this stage
- visual evidence quality (for image chunks)

Ignore chunks that are off-topic, redundant, or boilerplate (TOC, page numbers, acknowledgements). Rank the remaining candidates by overall fit, best first. For each, write a short reason (max 14 words) describing why it helps the student.

Return strict JSON: {"ranked": [{"chunk_id": <number>, "reason": "<string>"}, ...]}.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ranked: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chunk_id: { type: Type.NUMBER },
          reason: { type: Type.STRING },
        },
        required: ["chunk_id", "reason"],
      },
    },
  },
  required: ["ranked"],
};

async function fetchImageBase64(
  url: string,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return { data: buf.toString("base64"), mimeType: mimeType.split(";")[0] };
  } catch {
    return null;
  }
}

export type QueryInput =
  | { kind: "text"; text: string }
  | { kind: "image"; buffer: Buffer; mime: string };

/**
 * Re-rank candidates. Always returns `topK` items (or fewer if input was
 * smaller), even on AI failure — fallback path preserves identity order
 * with empty reasons.
 */
export async function rerank(
  query: QueryInput,
  candidates: RankedChunk[],
  topK = 8,
): Promise<RankedChunk[]> {
  const limited = candidates.slice(0, MAX_CANDIDATES);

  const fallback = (): RankedChunk[] =>
    limited.slice(0, topK).map((c, i) => ({ ...c, rerankRank: i + 1, reason: "" }));

  if (limited.length === 0) return [];
  if (!process.env.GEMINI_API_KEY) return fallback();

  // Pull bytes for image chunks (best effort; null on failure).
  const chunkImages = await Promise.all(
    limited.map((c) =>
      c.kind === "image" && c.imageBlobUrl
        ? fetchImageBase64(c.imageBlobUrl)
        : Promise.resolve(null),
    ),
  );

  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [{ text: PROMPT }];

  if (query.kind === "text") {
    parts.push({ text: `QUERY (text): ${query.text}` });
  } else {
    parts.push({ text: "QUERY (image):" });
    parts.push({
      inlineData: { data: query.buffer.toString("base64"), mimeType: query.mime },
    });
  }

  for (let i = 0; i < limited.length; i++) {
    const c = limited[i];
    const img = chunkImages[i];
    const meta =
      `CANDIDATE chunk_id=${c.id} ` +
      `source=${c.sourceTitle ?? c.sourceId} ` +
      `page=${c.page ?? "n/a"} ` +
      `kind=${c.kind}`;
    parts.push({ text: meta });
    if (c.contentText) {
      parts.push({ text: c.contentText.slice(0, 1200) });
    }
    if (img) {
      parts.push({ inlineData: img });
    } else if (c.kind === "image") {
      parts.push({ text: "(image unavailable)" });
    }
  }

  try {
    const client = getClient();
    const res = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.2,
      },
    });
    const text = res.text ?? "";
    const parsed = JSON.parse(text) as {
      ranked?: Array<{ chunk_id?: number; reason?: string }>;
    };
    const ranked = parsed.ranked ?? [];
    const byId = new Map(limited.map((c) => [c.id, c]));
    const out: RankedChunk[] = [];
    for (let i = 0; i < ranked.length && out.length < topK; i++) {
      const entry = ranked[i];
      if (!entry || typeof entry.chunk_id !== "number") continue;
      const cand = byId.get(entry.chunk_id);
      if (!cand) continue;
      out.push({
        ...cand,
        rerankRank: out.length + 1,
        reason: (entry.reason ?? "").slice(0, 200),
      });
    }
    if (out.length === 0) return fallback();
    return out;
  } catch (err) {
    console.warn(`[rag.rerank] falling back: ${(err as Error).message}`);
    return fallback();
  }
}

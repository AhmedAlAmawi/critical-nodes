/**
 * Grounding helper — wraps a Gemini call with citation-honest discipline.
 *
 * Every grounded AI moment in v3 goes through `ground()`. It:
 *   1. Builds a CONTEXT block listing each chunk with chunk_id + source + page.
 *   2. Appends a hard instruction requiring `citations: chunk_id[]` in the
 *      response, validated to be a subset of the retrieved set.
 *   3. Always returns a GroundedResponse with `citations` populated and
 *      `fallback: true` when the AI failed (caller may still surface the
 *      template-only path it provided).
 *
 * The function does NOT call retrieve() itself — callers control retrieval so
 * they can scope by assignment.
 */

import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { Citation, GroundedResponse, RankedChunk } from "./types";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  _client = new GoogleGenAI({ apiKey: key });
  return _client;
}

export type GroundArgs<TBody> = {
  /** Model id (e.g. "gemini-2.5-flash", "gemini-2.5-pro"). */
  model: string;
  systemPrompt: string;
  /** The user instruction. Will be augmented with the CONTEXT block. */
  userPrompt: string;
  /** Optional inline images for multimodal prompts (after the user prompt). */
  userImages?: Array<{ data: string; mimeType: string }>;
  chunks: RankedChunk[];
  /** Caller's response schema. We augment it with a required citations array
   *  unless one already exists. */
  responseSchema: Schema;
  temperature?: number;
  maxOutputTokens?: number;
  /** Result to return on failure. */
  fallback: TBody;
};

async function fetchImagePartFromBlob(
  url: string,
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    // Data URLs: parse inline, don't fetch.
    if (url.startsWith("data:")) {
      const m = /^data:([^;,]+)(?:;base64)?,(.*)$/.exec(url);
      if (!m) return null;
      const mimeType = m[1] || "image/jpeg";
      const isBase64 = url.includes(";base64,");
      const data = isBase64
        ? m[2]
        : Buffer.from(decodeURIComponent(m[2])).toString("base64");
      return { inlineData: { data, mimeType } };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return {
      inlineData: {
        data: buf.toString("base64"),
        mimeType: mimeType.split(";")[0],
      },
    };
  } catch {
    return null;
  }
}

function buildContextText(chunks: RankedChunk[]): string {
  if (chunks.length === 0) return "(no faculty context available)";
  const lines = chunks.map((c) => {
    const head = `[#${c.id}] ${c.sourceTitle ?? `source ${c.sourceId}`}${c.page ? ` p.${c.page}` : ""}`;
    const body =
      c.kind === "image"
        ? "(image — see attached)"
        : (c.contentText ?? "").slice(0, 800);
    return `${head}\n${body}`;
  });
  return lines.join("\n\n---\n\n");
}

function augmentSchemaWithCitations(schema: Schema): Schema {
  // If the caller's schema already includes `citations`, leave it alone.
  if (
    schema.type === Type.OBJECT &&
    schema.properties &&
    "citations" in schema.properties
  ) {
    return schema;
  }
  if (schema.type !== Type.OBJECT) return schema;
  return {
    ...schema,
    properties: {
      ...schema.properties,
      citations: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    },
    required: Array.from(
      new Set([...(schema.required ?? []), "citations"]),
    ),
  };
}

/**
 * Core grounded LLM call. Returns the parsed body, validated citations, and
 * timing — even on failure (with `fallback: true` and the caller's fallback
 * body returned verbatim).
 */
export async function ground<TBody>(
  args: GroundArgs<TBody>,
): Promise<GroundedResponse<TBody>> {
  const t0 = Date.now();
  const schema = augmentSchemaWithCitations(args.responseSchema);

  const contextText = buildContextText(args.chunks);
  const augmentedSystem = `${args.systemPrompt}\n\nCONTEXT (faculty-provided):\n${contextText}\n\nYour response MUST include "citations": [chunk_id, ...] covering exactly the chunks you actually used. Do not cite a chunk you did not use. Use empty array if none applied.`;

  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [{ text: args.userPrompt }];

  for (const img of args.userImages ?? []) {
    parts.push({ inlineData: img });
  }

  // Attach image chunks inline so the model can actually see them.
  for (const c of args.chunks) {
    if (c.kind === "image" && c.imageBlobUrl) {
      const part = await fetchImagePartFromBlob(c.imageBlobUrl);
      if (part) {
        parts.push({ text: `[image for chunk #${c.id}]` });
        parts.push(part);
      }
    }
  }

  const retrieveMs = 0; // retrieve() already happened; recorded by caller
  try {
    const client = getClient();
    const res = await client.models.generateContent({
      model: args.model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: augmentedSystem,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: args.temperature ?? 0.4,
        maxOutputTokens: args.maxOutputTokens,
      },
    });
    const text = res.text ?? "";
    const parsed = JSON.parse(text) as TBody & { citations?: number[] };
    const validated = validateCitations(parsed.citations ?? [], args.chunks);
    return {
      body: parsed,
      citations: validated,
      fallback: false,
      timingMs: { retrieve: retrieveMs, ground: Date.now() - t0, total: Date.now() - t0 },
    };
  } catch (err) {
    console.warn(`[rag.ground] falling back: ${(err as Error).message}`);
    return {
      body: args.fallback,
      citations: [],
      fallback: true,
      timingMs: { retrieve: retrieveMs, ground: Date.now() - t0, total: Date.now() - t0 },
    };
  }
}

function validateCitations(
  ids: number[],
  chunks: RankedChunk[],
): Citation[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const out: Citation[] = [];
  for (const id of ids) {
    const c = byId.get(Number(id));
    if (!c) continue;
    out.push({
      chunkId: c.id,
      sourceId: c.sourceId,
      page: c.page,
      sourceTitle: c.sourceTitle,
    });
  }
  return out;
}

/**
 * POST /api/audit
 *
 * Final cross-stage Alignment Audit (Prompt #9 of critical-nodes-v3.md).
 *
 * Body: { sessionId }.
 *
 * Pulls Stage A pedagogy outputs (concept + zoning phase state), Stage B
 * prompt assembly + latest render, runs RAG over the assignment scope,
 * then asks Gemini 2.5 Pro (multimodal) to emit
 *   { alignment[], drift[], contradiction[], summary, citations[] }.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Type } from "@google/genai";
import { requireRole } from "@/lib/auth";
import { retrieve } from "@/lib/rag/retrieve";
import { ground } from "@/lib/rag/ground";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type AuditBody = { sessionId: number };

type AuditPoint = {
  point: string;
  source: "intent" | "prompt" | "render";
  citations?: number[];
};

type AuditResult = {
  alignment: AuditPoint[];
  drift: AuditPoint[];
  contradiction: AuditPoint[];
  summary: string;
  citations?: number[];
};

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as AuditBody;
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const sessRows = (await sql`
    SELECT s.id, s.course_id, s.assignment_id,
           a.scope_source_ids, a.scope_chunk_ids
    FROM sessions s
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = ${body.sessionId} AND s.student_id = ${user.id}
    LIMIT 1
  `) as Array<{
    id: number;
    course_id: number | null;
    assignment_id: number | null;
    scope_source_ids: number[] | null;
    scope_chunk_ids: number[] | null;
  }>;
  if (!sessRows[0]) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  const sess = sessRows[0];

  const stateRows = (await sql`
    SELECT node_id, data FROM session_node_state WHERE session_id = ${body.sessionId}
  `) as unknown as Array<{ node_id: string; data: Record<string, unknown> }>;
  const states: Record<string, Record<string, unknown>> = {};
  for (const r of stateRows) states[r.node_id] = r.data ?? {};

  const renderRows = (await sql`
    SELECT prompt, blob_url FROM renders
    WHERE session_id = ${body.sessionId}
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{ prompt: string; blob_url: string }>;

  // Build a single retrieval query from the most important student inputs.
  const concept = states["concept"];
  const conceptStatement =
    (concept?.aiConceptStatement as string | undefined) ??
    (concept?.thinkAnswers as Record<string, string> | undefined)?.[2] ??
    "";
  const zoning = states["zoning"];
  const zoningSummary =
    (zoning?.actText as string | undefined) ??
    Object.values(
      (zoning?.thinkAnswers as Record<string, string> | undefined) ?? {},
    ).join(" ");

  const promptState = states["prompt"];
  const promptSummary = promptState
    ? Object.values(promptState).filter((v) => typeof v === "string").join(" · ")
    : "";

  const queryText = [conceptStatement, zoningSummary, promptSummary, renderRows[0]?.prompt]
    .filter(Boolean)
    .join("\n");

  let retrieved;
  if (sess.course_id && queryText) {
    try {
      retrieved = await retrieve(
        { kind: "text", text: queryText.slice(0, 1500) },
        {
          courseId: Number(sess.course_id),
          sourceIds: sess.scope_source_ids?.length
            ? sess.scope_source_ids.map(Number)
            : undefined,
          chunkIds: sess.scope_chunk_ids?.length
            ? sess.scope_chunk_ids.map(Number)
            : undefined,
          k: 10,
          hybridFts: true,
        },
      );
    } catch (err) {
      console.warn(`[audit] retrieve failed: ${(err as Error).message}`);
    }
  }
  const chunks = retrieved?.hits ?? [];

  // Multimodal: feed the actual render image as an inline image.
  const userImages: Array<{ data: string; mimeType: string }> = [];
  if (renderRows[0]?.blob_url) {
    try {
      const r = await fetch(renderRows[0].blob_url);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const mime = r.headers.get("content-type") ?? "image/png";
        userImages.push({
          data: buf.toString("base64"),
          mimeType: mime.split(";")[0],
        });
      }
    } catch {
      // skip
    }
  }

  const SYSTEM = `You are a senior design critic conducting a post-render alignment audit. Identify, for each point you raise, the specific decision and which side it came from (intent / prompt / render). Cite chunk_ids where relevant. Be terse — each "point" must be a single sentence. Be honest. No padding.`;

  const userPrompt = [
    `DECLARED INTENT (Stage A):`,
    `  Concept Statement: ${conceptStatement || "(none)"}`,
    `  Zoning summary: ${zoningSummary.slice(0, 600) || "(none)"}`,
    `CONSTRUCTED PROMPT (Stage B): ${promptSummary || renderRows[0]?.prompt || "(none)"}`,
    renderRows[0] ? "ACTUAL RENDER: [attached]" : "ACTUAL RENDER: (no render available)",
  ].join("\n");

  const schema = {
    type: Type.OBJECT,
    properties: {
      alignment: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            point: { type: Type.STRING },
            source: { type: Type.STRING },
            citations: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          },
          required: ["point", "source"],
        },
      },
      drift: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            point: { type: Type.STRING },
            source: { type: Type.STRING },
            citations: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          },
          required: ["point", "source"],
        },
      },
      contradiction: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            point: { type: Type.STRING },
            source: { type: Type.STRING },
            citations: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          },
          required: ["point", "source"],
        },
      },
      summary: { type: Type.STRING },
    },
    required: ["alignment", "drift", "contradiction", "summary"],
  };

  const grounded = await ground<AuditResult>({
    model: "gemini-2.5-pro",
    systemPrompt: SYSTEM,
    userPrompt,
    userImages,
    chunks,
    responseSchema: schema,
    temperature: 0.2,
    maxOutputTokens: 1000,
    fallback: {
      alignment: [],
      drift: [],
      contradiction: [],
      summary:
        "Audit AI unavailable. Compare your declared intent, prompt, and render side-by-side manually.",
    },
  });

  return NextResponse.json({
    ok: true,
    result: grounded.body,
    citations: grounded.citations,
    fallback: grounded.fallback,
  });
}

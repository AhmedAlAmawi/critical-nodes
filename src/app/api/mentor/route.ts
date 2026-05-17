/**
 * POST /api/mentor
 *
 * The universal grounded-mentor surface for v3. Every AI moment in the student
 * lifecycle (Stage A Reflect end, Stage A Synthesis refinement, Stage B node
 * advisories, Final Audit) routes through this handler.
 *
 * Body: {
 *   sessionId, nodeId, step?, prompt, query?,
 *   model? = "gemini-2.5-flash"
 * }
 *
 * Flow: scope = session.assignment.scope_chunk_ids? scope_source_ids? course
 *       → retrieve(query) → ground(...) with Prompt #2 (mentor) shape.
 *
 * Returns a strict-JSON GroundedResponse plus persists a row in mentor_messages.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Type } from "@google/genai";
import { requireRole } from "@/lib/auth";
import { retrieve } from "@/lib/rag/retrieve";
import { ground } from "@/lib/rag/ground";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MentorBody = {
  sessionId: number;
  nodeId: string;
  step?: string;
  /** Compact human prompt describing the moment (used as both query + user prompt). */
  prompt: string;
  /** Optional retrieval query — defaults to `prompt`. */
  query?: string;
  /** Force a model. */
  model?: string;
  /** Override temperature. */
  temperature?: number;
  /** Max output tokens (default 200). */
  maxTokens?: number;
};

type MentorSchemaBody = { feedback: string; citations?: number[] };

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("student");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as MentorBody;
  if (!body.sessionId || !body.nodeId || !body.prompt) {
    return NextResponse.json(
      { error: "sessionId, nodeId, prompt required" },
      { status: 400 },
    );
  }

  const sql = neon(process.env.DATABASE_URL!);
  // Verify session ownership + pull scope from assignment if any.
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

  const t0 = Date.now();
  let retrieved;
  if (sess.course_id) {
    try {
      retrieved = await retrieve(
        { kind: "text", text: body.query ?? body.prompt },
        {
          courseId: Number(sess.course_id),
          sourceIds: sess.scope_source_ids?.length
            ? sess.scope_source_ids.map(Number)
            : undefined,
          chunkIds: sess.scope_chunk_ids?.length
            ? sess.scope_chunk_ids.map(Number)
            : undefined,
          k: 8,
          hybridFts: true,
        },
      );
    } catch (err) {
      // Embedding/network failure — proceed with no grounding so the student
      // still sees a (template) mentor message.
      console.warn(`[mentor] retrieve failed: ${(err as Error).message}`);
    }
  }
  const chunks = retrieved?.hits ?? [];

  const SYSTEM = `You are a studio mentor reviewing a design student's work. Give exactly 1–2 sentences of honest, direct feedback. Be specific. No praise padding. No long explanations. Reflect the faculty context where it strengthens your reply; do not force it.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      feedback: { type: Type.STRING },
    },
    required: ["feedback"],
  };

  const grounded = await ground<MentorSchemaBody>({
    model: body.model ?? "gemini-2.5-flash",
    systemPrompt: SYSTEM,
    userPrompt: body.prompt,
    chunks,
    responseSchema: schema,
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.maxTokens ?? 200,
    fallback: { feedback: "" },
  });

  const ms = Date.now() - t0;

  // Persist the mentor message + update session_node_state.mentor_feedback.
  await sql`
    INSERT INTO mentor_messages
      (session_id, node_id, step, role, content, citations, model, ms)
    VALUES (
      ${body.sessionId},
      ${body.nodeId},
      ${body.step ?? null},
      'assistant',
      ${grounded.body.feedback ?? ""},
      ${JSON.stringify(grounded.citations)}::jsonb,
      ${body.model ?? "gemini-2.5-flash"},
      ${ms}
    )
  `;
  await sql`
    INSERT INTO session_node_state (session_id, node_id, mentor_feedback, updated_at)
    VALUES (
      ${body.sessionId},
      ${body.nodeId},
      ${JSON.stringify({ feedback: grounded.body.feedback, citations: grounded.citations })}::jsonb,
      now()
    )
    ON CONFLICT (session_id, node_id) DO UPDATE SET
      mentor_feedback = EXCLUDED.mentor_feedback,
      updated_at = now()
  `;

  return NextResponse.json({
    ok: true,
    feedback: grounded.body.feedback,
    citations: grounded.citations,
    fallback: grounded.fallback,
    timingMs: {
      retrieve: retrieved?.timingMs?.total ?? 0,
      ground: grounded.timingMs.ground,
      total: ms,
    },
  });
}

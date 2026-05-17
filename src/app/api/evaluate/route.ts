/**
 * POST /api/evaluate
 *
 * Faculty-only. Grades a student's full session against an assignment rubric
 * (Prompt #11 of critical-nodes-v3.md). Inserts a row into evaluations and
 * returns it.
 *
 * Body: { sessionId, assignmentId }
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Type } from "@google/genai";
import { requireRole } from "@/lib/auth";
import { retrieve } from "@/lib/rag/retrieve";
import { ground } from "@/lib/rag/ground";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = { sessionId: number; assignmentId: number };
type EvalResult = {
  rubric_scores: Record<
    string,
    { score: 0 | 1 | 2 | 3 | 4; evidence: string; citations?: number[] }
  >;
  narrative: string;
  citations?: number[];
};

const MODEL = "gemini-2.5-pro";

export async function POST(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireRole("faculty");
  } catch (res) {
    return res as NextResponse;
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.sessionId || !body.assignmentId) {
    return NextResponse.json(
      { error: "sessionId + assignmentId required" },
      { status: 400 },
    );
  }
  const sql = neon(process.env.DATABASE_URL!);

  // Verify faculty owns the course of this assignment.
  const owns = (await sql`
    SELECT a.id AS assignment_id, a.course_id, a.scope_source_ids,
           a.scope_chunk_ids, a.rubric, a.title, c.id AS course_id_check
    FROM assignments a JOIN courses c ON c.id = a.course_id
    WHERE a.id = ${body.assignmentId} AND c.owner_id = ${user.id}
    LIMIT 1
  `) as Array<{
    assignment_id: number;
    course_id: number;
    scope_source_ids: number[] | null;
    scope_chunk_ids: number[] | null;
    rubric: Record<string, unknown>;
    title: string;
  }>;
  if (!owns[0]) {
    return NextResponse.json({ error: "assignment not found" }, { status: 404 });
  }

  // Pull the student's session state.
  const sessRows = (await sql`
    SELECT id, student_id FROM sessions WHERE id = ${body.sessionId} LIMIT 1
  `) as Array<{ id: number; student_id: number }>;
  if (!sessRows[0]) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  const stateRows = (await sql`
    SELECT node_id, data FROM session_node_state WHERE session_id = ${body.sessionId}
  `) as unknown as Array<{ node_id: string; data: Record<string, unknown> }>;
  const sessionSummary = stateRows
    .map((r) => {
      const compact = Object.entries(r.data ?? {})
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v).slice(0, 200)}`)
        .join(" / ");
      return `[${r.node_id}] ${compact}`.slice(0, 800);
    })
    .join("\n");

  // RAG over scoped chunks.
  let retrieved;
  try {
    retrieved = await retrieve(
      { kind: "text", text: sessionSummary.slice(0, 1500) },
      {
        courseId: owns[0].course_id,
        sourceIds: owns[0].scope_source_ids?.length
          ? owns[0].scope_source_ids.map(Number)
          : undefined,
        chunkIds: owns[0].scope_chunk_ids?.length
          ? owns[0].scope_chunk_ids.map(Number)
          : undefined,
        k: 10,
        hybridFts: true,
      },
    );
  } catch (err) {
    console.warn(`[evaluate] retrieve failed: ${(err as Error).message}`);
  }
  const chunks = retrieved?.hits ?? [];

  const rubricStr =
    typeof owns[0].rubric === "object"
      ? JSON.stringify(owns[0].rubric)
      : String(owns[0].rubric);

  const SYSTEM = `You are evaluating a design-studio student's full session against the assignment rubric. For each rubric criterion, score 0-4 and cite the chunks the student demonstrated engagement with. Be specific. Reflect on what is missing as much as what is present.`;

  const userPrompt = `RUBRIC: ${rubricStr}\nSESSION:\n${sessionSummary}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      rubric_scores: {
        type: Type.OBJECT,
        // Free-form keyed dict; we leave it as OBJECT and validate shape below.
      },
      narrative: { type: Type.STRING },
    },
    required: ["rubric_scores", "narrative"],
  };

  const grounded = await ground<EvalResult>({
    model: MODEL,
    systemPrompt: SYSTEM,
    userPrompt,
    chunks,
    responseSchema: schema,
    temperature: 0.2,
    maxOutputTokens: 1200,
    fallback: {
      rubric_scores: { overall: { score: 2, evidence: "(AI unavailable)" } },
      narrative:
        "AI evaluation step was unavailable. Faculty must score manually.",
    },
  });

  const rows = (await sql`
    INSERT INTO evaluations
      (session_id, assignment_id, rubric_scores, narrative, citations, model)
    VALUES (
      ${body.sessionId},
      ${body.assignmentId},
      ${JSON.stringify(grounded.body.rubric_scores ?? {})}::jsonb,
      ${grounded.body.narrative ?? ""},
      ${JSON.stringify(grounded.citations)}::jsonb,
      ${MODEL}
    )
    RETURNING id
  `) as Array<{ id: number }>;

  return NextResponse.json({
    ok: true,
    evaluationId: Number(rows[0].id),
    result: grounded.body,
    citations: grounded.citations,
    fallback: grounded.fallback,
  });
}

/**
 * Session receipt — one structured record of everything a student produced
 * in a session, assembled from sessions / session_node_state /
 * mentor_messages / renders / evaluations.
 *
 * Used by:
 *   - /studio/[id]/receipt            (student, print + JSON download + submit)
 *   - /faculty/courses/[id]/sessions/[sessionId]   (faculty view)
 *   - GET /api/sessions/[id]/receipt  (JSON)
 *
 * Authorization is the caller's responsibility; this module only loads by id.
 */

import "server-only";
import { neon } from "@neondatabase/serverless";
import { conceptPhase } from "@/lib/phases/concept";
import { zoningPhase } from "@/lib/phases/zoning";
import type { Phase, PhaseState } from "@/lib/phases/types";
import { emptyPhaseState } from "@/lib/phases/types";

export type ReceiptQA = { question: string; answer: string };

export type ReceiptImage = { label: string; url: string; note?: string };

export type PhaseReceipt = {
  id: "concept" | "zoning";
  title: string;
  step: PhaseState["step"];
  completedAt: string | null;
  updatedAt: string | null;
  sketch: { url: string; note: string } | null;
  thinking: ReceiptQA[];
  driver: ReceiptQA | null;
  compare: ReceiptQA | null;
  actText: string;
  actImageUrl: string | null;
  missions: Array<{ title: string; required: boolean; note: string; imageUrl: string | null }>;
  reflection: ReceiptQA[];
  mentorFeedback: string | null;
  mentorCitations: number;
  conceptStatement: string | null; // concept phase only
};

export type GenericNodeReceipt = {
  id: string;
  label: string;
  completedAt: string | null;
  updatedAt: string | null;
  fields: Array<{ label: string; value: string }>;
  images: ReceiptImage[];
  mentorFeedback: string | null;
};

export type SessionReceipt = {
  session: {
    id: number;
    status: string;
    startedAt: string;
    endedAt: string | null;
    courseId: number | null;
    courseTitle: string | null;
    assignmentId: number | null;
    assignmentTitle: string | null;
    requiredNodes: string[];
  };
  student: { id: number; displayName: string | null; email: string | null };
  phases: PhaseReceipt[];
  nodes: GenericNodeReceipt[];
  mentorMessages: Array<{ nodeId: string; step: string | null; content: string; createdAt: string; citations: number }>;
  renders: Array<{ id: number; prompt: string; url: string; createdAt: string }>;
  evaluations: Array<{ id: number; createdAt: string; narrative: string }>;
  totals: { answers: number; images: number; nodesCompleted: number; nodesTotal: number };
  generatedAt: string;
};

const STAGE_B_LABELS: Record<string, string> = {
  intent: "Design Mentor / Intent",
  visualPriority: "Visual Priority",
  references: "Reference Deconstruction",
  geometry: "Geometry & View",
  materialsLight: "Material & Light",
  prompt: "Prompt Architecture",
  audit: "Per-node Alignment Audit",
  finalAudit: "Final Alignment Audit",
};

const ALL_NODES = ["concept", "zoning", "intent", "visualPriority", "references", "geometry", "materialsLight", "prompt", "audit", "finalAudit"];

type StateRow = {
  node_id: string;
  data: unknown;
  mentor_feedback: unknown;
  completed_at: string | null;
  updated_at: string;
};

function isImageish(v: unknown): v is string {
  return typeof v === "string" && (/^data:image\//.test(v) || /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v) || /blob\.vercel-storage\.com/.test(v));
}

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function phaseReceipt(phase: Phase, row: StateRow | undefined): PhaseReceipt {
  const d: PhaseState = { ...emptyPhaseState(), ...((row?.data as Partial<PhaseState>) ?? {}) };
  const mf = (row?.mentor_feedback as { feedback?: string; citations?: unknown[] } | null) ?? null;
  const thinking: ReceiptQA[] = [];
  phase.questions.forEach((q, i) => {
    const a = d.thinkAnswers[i];
    if (a && String(a).trim()) thinking.push({ question: q, answer: String(a) });
  });
  const reflection: ReceiptQA[] = [];
  if (d.reflectAnswers[97]) reflection.push({ question: "Looking at your work now, what would you change?", answer: d.reflectAnswers[97] });
  if (d.reflectAnswers[0]) reflection.push({ question: phase.reflection[0], answer: d.reflectAnswers[0] });
  for (let i = 1; i < phase.reflection.length; i++) {
    const a = d.reflectAnswers[i];
    if (a && a.trim()) reflection.push({ question: phase.reflection[i], answer: a });
  }
  const missions = (phase.missions ?? [])
    .map((m) => {
      const o = d.diagramOutputs[m.outputKey];
      if (!o || (!o.image && !o.text)) return null;
      return { title: m.title, required: m.required, note: o.text ?? "", imageUrl: o.image ?? null };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return {
    id: phase.id,
    title: phase.title,
    step: d.step,
    completedAt: row?.completed_at ?? null,
    updatedAt: row?.updated_at ?? null,
    sketch: d.userSketch ? { url: d.userSketch, note: d.userSketchNote ?? "" } : null,
    thinking,
    driver: d.thinkAnswers[99] ? { question: phase.driverQuestion, answer: d.thinkAnswers[99] } : null,
    compare: d.thinkAnswers[98] ? { question: phase.compareQuestion, answer: d.thinkAnswers[98] } : null,
    actText: d.actText ?? "",
    actImageUrl: d.actImageUrl ?? null,
    missions,
    reflection,
    mentorFeedback: d.aiFeedback || mf?.feedback || null,
    mentorCitations: d.aiFeedbackCitations?.length ?? (Array.isArray(mf?.citations) ? mf!.citations!.length : 0),
    conceptStatement: phase.id === "concept" ? d.aiConceptStatement ?? null : null,
  };
}

function genericReceipt(row: StateRow): GenericNodeReceipt {
  const fields: GenericNodeReceipt["fields"] = [];
  const images: ReceiptImage[] = [];
  const walk = (obj: unknown, prefix: string) => {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      if (obj.every((x) => typeof x !== "object" || x == null)) {
        const vals = obj.filter((x) => x != null && String(x).trim()).map(String);
        if (vals.length) fields.push({ label: humanize(prefix), value: vals.join(" · ") });
      } else {
        obj.forEach((item, i) => walk(item, `${prefix} ${i + 1}`));
      }
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (k === "id" || k === "file" || k === "processing" || k === "preview") continue;
        const label = prefix ? `${prefix} · ${humanize(k)}` : humanize(k);
        if (isImageish(v)) {
          images.push({ label, url: v });
        } else if (typeof v === "object" && v != null) {
          walk(v, label);
        } else if (v != null && String(v).trim() !== "" && v !== false) {
          fields.push({ label, value: typeof v === "boolean" ? (v ? "Yes" : "No") : String(v) });
        }
      }
    }
  };
  walk(row.data, "");
  const mf = (row.mentor_feedback as { feedback?: string } | null) ?? null;
  return {
    id: row.node_id,
    label: STAGE_B_LABELS[row.node_id] ?? humanize(row.node_id),
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    fields,
    images,
    mentorFeedback: mf?.feedback ?? null,
  };
}

export async function loadSessionReceipt(sessionId: number): Promise<SessionReceipt | null> {
  const sql = neon(process.env.DATABASE_URL!);
  const sessRows = (await sql`
    SELECT s.id, s.status, s.started_at, s.ended_at, s.course_id, s.assignment_id,
           c.title AS course_title, a.title AS assignment_title, a.required_nodes,
           u.id AS student_id, u.display_name, u.email
    FROM sessions s
    JOIN users u ON u.id = s.student_id
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = ${sessionId}
    LIMIT 1
  `) as Array<{
    id: number;
    status: string;
    started_at: string;
    ended_at: string | null;
    course_id: number | null;
    assignment_id: number | null;
    course_title: string | null;
    assignment_title: string | null;
    required_nodes: string[] | null;
    student_id: number;
    display_name: string | null;
    email: string | null;
  }>;
  const s = sessRows[0];
  if (!s) return null;

  const states = (await sql`
    SELECT node_id, data, mentor_feedback, completed_at, updated_at
    FROM session_node_state WHERE session_id = ${sessionId}
  `) as unknown as StateRow[];
  const byNode = new Map(states.map((r) => [r.node_id, r]));

  const mentor = (await sql`
    SELECT node_id, step, content, citations, created_at FROM mentor_messages
    WHERE session_id = ${sessionId} AND role = 'assistant' AND content <> ''
    ORDER BY created_at ASC
  `) as unknown as Array<{ node_id: string; step: string | null; content: string; citations: unknown; created_at: string }>;

  const renders = (await sql`
    SELECT id, prompt, blob_url, created_at FROM renders WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `) as unknown as Array<{ id: number; prompt: string; blob_url: string; created_at: string }>;

  const evals = (await sql`
    SELECT id, narrative, created_at FROM evaluations WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
  `) as unknown as Array<{ id: number; narrative: string; created_at: string }>;

  const phases = [phaseReceipt(conceptPhase, byNode.get("concept")), phaseReceipt(zoningPhase, byNode.get("zoning"))];
  const nodes = states
    .filter((r) => r.node_id !== "concept" && r.node_id !== "zoning")
    .sort((a, b) => ALL_NODES.indexOf(a.node_id) - ALL_NODES.indexOf(b.node_id))
    .map(genericReceipt);

  const requiredNodes = s.required_nodes && s.required_nodes.length ? s.required_nodes : ALL_NODES;
  const answers =
    phases.reduce((n, p) => n + p.thinking.length + (p.driver ? 1 : 0) + (p.compare ? 1 : 0) + p.reflection.length + (p.actText ? 1 : 0) + p.missions.filter((m) => m.note).length, 0) +
    nodes.reduce((n, g) => n + g.fields.length, 0);
  const images =
    phases.reduce((n, p) => n + (p.sketch ? 1 : 0) + (p.actImageUrl ? 1 : 0) + p.missions.filter((m) => m.imageUrl).length, 0) +
    nodes.reduce((n, g) => n + g.images.length, 0) +
    renders.length;
  const nodesCompleted = states.filter((r) => r.completed_at && requiredNodes.includes(r.node_id)).length;

  return {
    session: {
      id: Number(s.id),
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      courseId: s.course_id == null ? null : Number(s.course_id),
      courseTitle: s.course_title,
      assignmentId: s.assignment_id == null ? null : Number(s.assignment_id),
      assignmentTitle: s.assignment_title,
      requiredNodes,
    },
    student: { id: Number(s.student_id), displayName: s.display_name, email: s.email },
    phases,
    nodes,
    mentorMessages: mentor.map((m) => ({
      nodeId: m.node_id,
      step: m.step,
      content: m.content,
      createdAt: m.created_at,
      citations: Array.isArray(m.citations) ? m.citations.length : 0,
    })),
    renders: renders.map((r) => ({ id: Number(r.id), prompt: r.prompt, url: r.blob_url, createdAt: r.created_at })),
    evaluations: evals.map((e) => ({ id: Number(e.id), createdAt: e.created_at, narrative: e.narrative })),
    totals: { answers, images, nodesCompleted, nodesTotal: requiredNodes.length },
    generatedAt: new Date().toISOString(),
  };
}

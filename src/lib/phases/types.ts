/**
 * Phase content shape — generalized from §4 of malzama-investigation.md.
 *
 * Same shape for Concept and Zoning phases. Faculty-uploaded sources can
 * shadow the academic library at runtime via referenceId resolution.
 */

export type Insight = {
  text: string;
  referenceId: string;
  visual: string;
  caption: string;
  compare: boolean;
};

export type Mission = {
  id: string;
  title: string;
  required: boolean;
  referenceId: string;
  insight: string;
  visual: string;
  caption: string;
  task: string;
  outputKey: string;
  placeholder: string;
};

export type Phase = {
  id: "concept" | "zoning";
  title: string;
  subtitle: string;
  goal: string;
  conceptDefinition: string;
  academic: { source: string; insight: string };
  example: string;
  exampleExplanation: string;
  questions: string[];
  questionOptions: (string[] | null)[];
  thinkResponses: string[];
  questionInsights: (Insight | null)[];
  driverQuestion: string;
  driverOptions: string[];
  driverResponse: string;
  reference: { image: string; caption: string; source: string };
  compareQuestion: string;
  compareOptions: string[];
  compareResponse: string;
  action: { instruction: string; description: string; placeholder: string };
  missionsIntro?: string;
  missions?: Mission[];
  reflection: string[];
  reflectChoices: string[];
  reflectResponses: string[];
};

/**
 * The per-step shape that the phase-runner persists into
 * session_node_state.data for phase nodes. Mirrors malzama's in-memory
 * state object (§3 of the investigation) with magic keys 97 / 98 / 99
 * preserved.
 */
export type PhaseState = {
  step: "orient" | "sketch" | "think" | "act" | "reflect" | "synthesis" | "end";
  orientStep: 0 | 1 | 2;
  userSketch: string | null;       // base64 data URL OR blob URL
  userSketchNote: string;
  thinkIndex: number;              // current dynamic step index
  thinkAnswers: Record<string | number, string>; // 0..n + 97 + 98 + 99
  actText: string;
  actImageUrl: string | null;
  diagramOutputs: Record<string, { text: string; image: string | null }>;
  /** Current mission index inside the Act → Missions flow (resumable). */
  missionIndex: number;
  reflectIndex: number;
  reflectAnswers: Record<string | number, string>;
  aiFeedback: string | null;
  aiFeedbackCitations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
  /** AI-refined concept statement (Stage A synthesis only). */
  aiConceptStatement: string | null;
};

export function emptyPhaseState(): PhaseState {
  return {
    step: "orient",
    orientStep: 0,
    userSketch: null,
    userSketchNote: "",
    thinkIndex: 0,
    thinkAnswers: {},
    actText: "",
    actImageUrl: null,
    diagramOutputs: {},
    missionIndex: 0,
    reflectIndex: 0,
    reflectAnswers: {},
    aiFeedback: null,
    aiFeedbackCitations: [],
    aiConceptStatement: null,
  };
}

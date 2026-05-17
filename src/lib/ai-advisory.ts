import type {
  IntentData,
  ConceptClaritySummary,
  ReferenceBreakdown,
  MaterialJustification,
  LightingData,
} from "./store";

const ADVISORY_MODEL = "gemini-3.1-flash-lite-preview";

interface AdvisoryRequest {
  type: "concept-clarity" | "reference-alignment" | "material-light" | "sketch-evaluation";
  data: unknown;
}

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("gemini_api_key") || "";
}

async function callAdvisory<T>(request: AdvisoryRequest): Promise<T> {
  const geminiKey = getApiKey();
  const res = await fetch("/api/advisory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(geminiKey && { "x-gemini-key": geminiKey }),
    },
    body: JSON.stringify(request),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result as T;
}

export async function generateConceptClaritySummary(
  intent: IntentData
): Promise<ConceptClaritySummary> {
  return callAdvisory<ConceptClaritySummary>({
    type: "concept-clarity",
    data: intent,
  });
}

export async function checkReferenceAlignment(
  reference: ReferenceBreakdown,
  intent: IntentData
): Promise<string | null> {
  const result = await callAdvisory<{ alert: string | null }>({
    type: "reference-alignment",
    data: { reference, intent },
  });
  return result.alert;
}

export async function checkMaterialLightInteraction(
  materials: MaterialJustification[],
  lighting: LightingData
): Promise<string[]> {
  const result = await callAdvisory<{ flags: string[] }>({
    type: "material-light",
    data: { materials, lighting },
  });
  return result.flags;
}

export async function evaluateSketch(
  sketchBase64: string,
  context: string
): Promise<string> {
  const result = await callAdvisory<{ feedback: string }>({
    type: "sketch-evaluation",
    data: { sketchBase64, context },
  });
  return result.feedback;
}

/**
 * v3 grounded mentor call. Use this from any v2 advisory hook that has a
 * server-side sessionId (e.g. when running inside /studio/[id]/visualize).
 * Returns the grounded feedback + chunk citations so callers can render the
 * "cited n sources" chip.
 *
 * Falls back to a v2-style ungrounded summary by calling /api/advisory if
 * sessionId is not provided.
 */
export async function groundedMentor(args: {
  sessionId?: number;
  nodeId: string;
  step?: string;
  prompt: string;
  query?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{
  feedback: string;
  citations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
  fallback?: boolean;
}> {
  if (!args.sessionId) {
    // No session context — caller is the standalone v2 path. Return an empty
    // grounded shape so the chip just doesn't appear.
    return { feedback: "", citations: [], fallback: true };
  }
  try {
    const res = await fetch("/api/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: args.sessionId,
        nodeId: args.nodeId,
        step: args.step,
        prompt: args.prompt,
        query: args.query,
        temperature: args.temperature ?? 0.4,
        maxTokens: args.maxTokens ?? 400,
      }),
    });
    if (!res.ok) throw new Error(`mentor ${res.status}`);
    return (await res.json()) as {
      feedback: string;
      citations: Array<{ chunkId: number; sourceId: number; page: number | null }>;
      fallback?: boolean;
    };
  } catch (err) {
    console.warn(`[ai-advisory] groundedMentor failed: ${(err as Error).message}`);
    return { feedback: "", citations: [], fallback: true };
  }
}

export { ADVISORY_MODEL };
export type { AdvisoryRequest };

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

export { ADVISORY_MODEL };
export type { AdvisoryRequest };

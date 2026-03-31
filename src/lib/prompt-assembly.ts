import type {
  IntentData,
  MaterialJustification,
  LightingData,
  ReferenceBreakdown,
  PromptFields,
  Session,
} from "./store";

export function assemblePrompt(session: Session, promptFields: PromptFields): string {
  const lines: string[] = [];

  lines.push("You are rendering a photorealistic architectural visualization.");
  lines.push("");

  if (session.intent) {
    lines.push("[INTENT]");
    lines.push(`Concept: ${session.intent.conceptStatement}`);
    lines.push(`Target user: ${session.intent.targetUser}`);
    lines.push(`Spatial goal: ${session.intent.spatialGoal}`);
    lines.push(`Emotional atmosphere: ${session.intent.emotionalAtmosphere}`);
    lines.push(`Image type: ${session.intent.imageType}`);
    lines.push(`Intent statement: ${session.intent.intentStatement}`);
    lines.push("");
  }

  if (session.materialJustifications.length > 0) {
    lines.push("[MATERIALS]");
    session.materialJustifications.forEach((m, i) => {
      lines.push(`Material ${i + 1}: ${m.materialName}`);
      lines.push(`  Purpose: ${m.whyForUser}`);
      lines.push(`  Tactile: ${m.tactileQuality}`);
      lines.push(`  Light behavior: ${m.lightBehavior}`);
    });
    lines.push("");
  }

  if (session.lighting) {
    lines.push("[LIGHTING]");
    lines.push(`Time of day: ${session.lighting.timeOfDay}`);
    lines.push(`Light source: ${session.lighting.lightSource}`);
    lines.push(`Contrast: ${session.lighting.contrastLevel}`);
    lines.push(`Shadow intention: ${session.lighting.shadowIntention}`);
    lines.push(`Mood: ${session.lighting.moodProduced}`);
    if (session.lighting.preset && session.lighting.preset !== "custom") {
      lines.push(`Preset: ${session.lighting.preset}`);
    }
    lines.push("");
  }

  if (session.referenceBreakdowns.length > 0) {
    lines.push("[REFERENCES]");
    session.referenceBreakdowns.forEach((r, i) => {
      lines.push(`Reference ${i + 1}:`);
      lines.push(`  Lens: ${r.lens}`);
      lines.push(`  Framing: ${r.framing}`);
      lines.push(`  Tone: ${r.tone}`);
      lines.push(`  Grain: ${r.grain}`);
      lines.push(`  Color temperature: ${r.colorTemperature}`);
      lines.push(`  Emotion: ${r.emotion}`);
      lines.push(`  NOT borrowing: ${r.notBorrowing}`);
    });
    lines.push("");
  }

  lines.push("[PROMPT ARCHITECTURE]");
  lines.push(`Lens: ${promptFields.lens}`);
  lines.push(`Lighting: ${promptFields.lighting}`);
  lines.push(`Materials: ${promptFields.materials}`);
  lines.push(`Camera height: ${promptFields.cameraHeight}`);
  lines.push(`Mood: ${promptFields.mood}`);
  lines.push(`Composition: ${promptFields.composition}`);
  lines.push(`Resolution: ${promptFields.resolution}`);
  lines.push("");

  lines.push("The first image is a 3D model screenshot that defines the spatial layout, geometry, and camera angle.");
  lines.push("Maintain the exact camera angle and spatial proportions from the 3D model.");
  lines.push("Apply all declared materials, lighting, and atmospheric choices to produce a photorealistic result.");
  lines.push("Ensure the render communicates the declared emotional atmosphere and intent.");

  return lines.join("\n");
}

export function assemblePromptFromSession(session: Session): string {
  const pf = session.promptFields ?? {
    lens: "",
    lighting: "",
    materials: "",
    cameraHeight: "",
    mood: "",
    composition: "",
    resolution: "",
  };
  return assemblePrompt(session, pf);
}

export function buildSystemPromptWithImages(
  assembledPrompt: string,
  materialCount: number,
  referenceCount: number
): string {
  const parts: string[] = [];

  parts.push(assembledPrompt);
  parts.push("");

  if (materialCount > 0) {
    const matRange = materialCount === 1
      ? "Image 2"
      : `Images 2-${1 + materialCount}`;
    parts.push(
      `${matRange} ${materialCount === 1 ? "is a" : "are"} reference material/texture ${materialCount === 1 ? "sample" : "samples"} — apply these to the surfaces as declared in the materials section.`
    );
  }

  if (referenceCount > 0) {
    const refStart = 2 + materialCount;
    const refRange = referenceCount === 1
      ? `Image ${refStart}`
      : `Images ${refStart}-${refStart + referenceCount - 1}`;
    parts.push(
      `${refRange} ${referenceCount === 1 ? "is a" : "are"} visual reference ${referenceCount === 1 ? "image" : "images"} — borrow only the declared elements (lens, tone, framing) as specified in the references section.`
    );
  }

  return parts.join("\n");
}

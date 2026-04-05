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

  // --- Pillar 1: Structure ---
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

  if (session.visualPriority) {
    lines.push("[VISUALIZATION TARGET]");
    lines.push(`Primary focus: ${session.visualPriority.primaryFocusArea}`);
    if (session.visualPriority.secondaryFocusArea) {
      lines.push(`Secondary focus: ${session.visualPriority.secondaryFocusArea}`);
    }
    if (session.visualPriority.sequenceThreshold) {
      lines.push(`Sequence/threshold: ${session.visualPriority.sequenceThreshold}`);
    }
    lines.push(`Visualization target: ${session.visualPriority.visualizationTarget}`);
    lines.push("");
  }

  if (session.geometryValidation) {
    lines.push("[GEOMETRY & CAMERA]");
    if (session.geometryValidation.cameraRelationship) {
      lines.push(`Camera view: intentionally ${session.geometryValidation.cameraRelationship} to reference`);
    }
    if (session.geometryValidation.cameraJustification) {
      lines.push(`Camera justification: ${session.geometryValidation.cameraJustification}`);
    }
    lines.push("");
  }

  // --- Pillar 2: Reference ---
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
      if (r.borrowingCategories && r.borrowingCategories.length > 0) {
        lines.push(`  Borrowing: ${r.borrowingCategories.join(", ")}`);
      }
    });
    lines.push("");
  }

  // --- Pillar 3: Vision ---
  if (session.materialJustifications.length > 0) {
    lines.push("[MATERIALS]");
    session.materialJustifications.forEach((m, i) => {
      lines.push(`Material ${i + 1}: ${m.materialName}`);
      lines.push(`  Purpose: ${m.whyForUser}`);
      lines.push(`  Tactile: ${m.tactileQuality}`);
      lines.push(`  Light behavior: ${m.lightBehavior}`);
      if (m.zone) {
        lines.push(`  Zone: ${m.zone}`);
      }
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

  lines.push("[PROMPT ARCHITECTURE]");
  lines.push(`Lens: ${promptFields.lens}`);
  lines.push(`Lighting: ${promptFields.lighting}`);
  lines.push(`Materials: ${promptFields.materials}`);
  lines.push(`Camera height: ${promptFields.cameraHeight}`);
  lines.push(`Mood: ${promptFields.mood}`);
  lines.push(`Composition: ${promptFields.composition}`);
  lines.push(`Resolution: ${promptFields.resolution}`);
  lines.push("");

  lines.push("[CRITICAL GEOMETRY CONSTRAINTS]");
  lines.push("The first image is a 3D model screenshot that defines the EXACT spatial layout, geometry, camera angle, and proportions.");
  lines.push("You MUST treat this 3D model as the absolute ground truth for all geometry.");
  lines.push("DO NOT alter, add, remove, or reinterpret ANY architectural elements, walls, openings, structural members, floor levels, ceiling heights, or spatial boundaries.");
  lines.push("DO NOT hallucinate or invent geometry that is not present in the 3D model — every wall, column, slab, opening, and surface must match the model EXACTLY.");
  lines.push("DO NOT change the camera angle, field of view, perspective distortion, or spatial proportions from the 3D model.");
  lines.push("DO NOT add windows, doors, furniture, objects, people, or landscape elements unless they are explicitly visible in the 3D model screenshot.");
  lines.push("The 3D model geometry is LOCKED — your only job is to apply materials, lighting, and atmosphere to the EXISTING geometry.");
  lines.push("");
  lines.push("[RENDERING INSTRUCTIONS]");
  lines.push("Apply all declared materials, lighting, and atmospheric choices to produce a photorealistic result.");
  lines.push("Ensure the render communicates the declared emotional atmosphere and intent.");
  lines.push("The final image must be indistinguishable in spatial layout from the provided 3D model — only surface treatment, lighting, and atmosphere should change.");

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

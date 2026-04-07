"use client";

import { createContext, useContext } from "react";

// --- Node Types ---

export type NodeId = "intent" | "visualPriority" | "references" | "geometry" | "materialsLight" | "prompt" | "audit";

export const NODE_ORDER: NodeId[] = ["intent", "visualPriority", "references", "geometry", "materialsLight", "prompt", "audit"];

export const NODE_LABELS: Record<NodeId, string> = {
  intent: "Design Mentor",
  visualPriority: "Visual Priority",
  references: "Reference Deconstruction",
  geometry: "Geometry & View",
  materialsLight: "Material & Light",
  prompt: "Prompt Architecture",
  audit: "Alignment Audit",
};

export const NODE_DESCRIPTIONS: Record<NodeId, string> = {
  intent: "Articulate the foundational intent of your visualization through guided reflection. This becomes the anchor for every decision that follows.",
  visualPriority: "Identify which space or moment in your project best embodies your concept. Define what deserves to be visualized and why.",
  references: "Deconstruct your references analytically. Identify exactly what you are borrowing — and what you are not — and verify alignment with your intent.",
  geometry: "Upload your 3D model and validate the camera view against your references. Once confirmed, this geometry guides all subsequent visualization decisions.",
  materialsLight: "Justify every material choice and define your lighting logic. Connect each decision to the user, the concept, and the spatial intent.",
  prompt: "Construct the prompt using the structure-reference-vision hierarchy. Review prior decisions and generate your visualization.",
  audit: "Reflect on the render against your declared intent. Identify what aligns, what is inconsistent, and how it could be improved.",
};

export const NODE_TIPS: Record<NodeId, string> = {
  intent: "Think like a design mentor — not filling a form, but articulating why this visualization matters.",
  visualPriority: "Ask yourself: if I could only show one moment of this project, what would it be?",
  references: "Be surgical. Don't borrow vibes — borrow specific compositional, tonal, or material strategies.",
  geometry: "Your camera is a design decision. The angle you choose determines what the viewer understands.",
  materialsLight: "Materials and light are inseparable. A material only exists as light reveals it.",
  prompt: "The prompt assembles your declared decisions. Review each section before generating.",
  audit: "Honest reflection here teaches more than the render itself. What did the AI understand? What did it miss?",
};

// --- Image Types ---

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  base64: string | null;
  mimeType: string | null;
  processing: boolean;
}

export interface RenderHistoryItem {
  id: string;
  prompt: string;
  thumbnail: string;
  fullImage: string | null;
  createdAt: number;
  model: string;
  aspectRatio: string;
  sessionId?: string;
}

export type GeminiModel =
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview";

// --- Node Data Types ---

export interface SocraticResponses {
  spatialMechanism: string;
  visualMoment: string;
  oppositeDescription: string;
  failureScenario: string;
}

export interface ConceptClaritySummary {
  wellDefined: string[];
  ambiguous: string[];
  suggestions: string[];
  readings: string[];
}

export interface IntentData {
  conceptStatement: string;
  targetUser: string;
  spatialGoal: string;
  emotionalAtmosphere: string;
  behaviorReinforcement: string;
  imageType: "documentary" | "atmospheric" | "material-focused" | "narrative" | "";
  intentStatement: string;
  socraticResponses?: SocraticResponses;
  conceptSketchBase64?: string | null;
}

export interface VisualPriorityData {
  primaryFocusArea: string;
  secondaryFocusArea: string;
  sequenceThreshold: string;
  visualizationTarget: string;
  sketchBase64: string | null;
  sketchFeedback: string | null;
}

export const BORROWING_CATEGORIES = [
  "Camera angle",
  "Lighting",
  "Material palette",
  "Composition",
  "Spatial hierarchy",
  "Mood",
] as const;

export type BorrowingCategory = typeof BORROWING_CATEGORIES[number];

export interface ReferenceBreakdown {
  id: string;
  lens: string;
  framing: string;
  tone: string;
  grain: string;
  colorTemperature: string;
  notBorrowing: string;
  emotion: string;
  borrowingCategories: BorrowingCategory[];
  annotationSketchBase64?: string | null;
  annotationFeedback?: string | null;
}

export interface GeometryValidationData {
  cameraRelationship: "similar" | "different" | "";
  cameraJustification: string;
  validated: boolean;
}

export interface MaterialJustification {
  id: string;
  materialName: string;
  whyForUser: string;
  tactileQuality: string;
  lightBehavior: string;
  culturalCoherence: string;
  conceptReinforcement: string;
  zone: string;
}

export interface LightingData {
  timeOfDay: string;
  lightSource: "natural" | "artificial" | "mixed" | "";
  contrastLevel: string;
  shadowIntention: string;
  moodProduced: string;
  preset: "overcast" | "golden-hour" | "high-contrast" | "flat-documentary" | "custom" | "";
}

export interface PromptFields {
  lens: string;
  lighting: string;
  materials: string;
  cameraHeight: string;
  mood: string;
  composition: string;
  resolution: string;
}

export interface AuditData {
  alignsWellWithIntent: string;
  inconsistentPart: string;
  improvementSuggestion: string;
  mismatches: [string, string, string];
  refinementCount: number;
}

export interface NodeRevision {
  timestamp: number;
  snapshot: unknown;
}

// --- Node Status ---

export type NodeStatus = "empty" | "partial" | "complete" | "skipped";

// --- Session Type ---

export interface Session {
  id: string;
  name: string;
  currentNode: NodeId;
  intent: IntentData | null;
  conceptClaritySummary: ConceptClaritySummary | null;
  visualPriority: VisualPriorityData | null;
  referenceBreakdowns: ReferenceBreakdown[];
  geometryValidation: GeometryValidationData | null;
  materialJustifications: MaterialJustification[];
  lighting: LightingData | null;
  promptFields: PromptFields | null;
  audit: AuditData | null;
  renderThumbnail: string | null;
  skippedNodes: NodeId[];
  nodeRevisions: Record<string, NodeRevision[]>;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

// --- Helpers ---

export function canAccessNode(_session: Session | null, _targetNode: NodeId): boolean {
  if (!_session) return false;
  return true;
}

export function getNextNode(currentNode: NodeId): NodeId | null {
  const idx = NODE_ORDER.indexOf(currentNode);
  return idx < NODE_ORDER.length - 1 ? NODE_ORDER[idx + 1] : null;
}

export function getActiveSession(state: AppState): Session | null {
  if (!state.activeSessionId) return null;
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}

export function createEmptySession(name?: string): Session {
  return {
    id: crypto.randomUUID(),
    name: name || `Session ${new Date().toLocaleDateString()}`,
    currentNode: "intent",
    intent: null,
    conceptClaritySummary: null,
    visualPriority: null,
    referenceBreakdowns: [],
    geometryValidation: null,
    materialJustifications: [],
    lighting: null,
    promptFields: null,
    audit: null,
    renderThumbnail: null,
    skippedNodes: [],
    nodeRevisions: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
  };
}

export function isNodeComplete(session: Session, node: NodeId): boolean {
  const nodeIdx = NODE_ORDER.indexOf(node);
  const currentIdx = NODE_ORDER.indexOf(session.currentNode);
  if (nodeIdx < currentIdx) return true;
  return getNodeStatus(session, node) === "complete";
}

export function getNodeStatus(session: Session, node: NodeId): NodeStatus {
  if (session.skippedNodes.includes(node)) return "skipped";

  switch (node) {
    case "intent":
      if (!session.intent) return "empty";
      if (session.intent.intentStatement.trim().length > 0) return "complete";
      return "partial";
    case "visualPriority":
      if (!session.visualPriority) return "empty";
      if (session.visualPriority.visualizationTarget.trim().length > 0) return "complete";
      return "partial";
    case "references":
      if (session.referenceBreakdowns.length === 0) return "empty";
      return "complete";
    case "geometry":
      if (!session.geometryValidation) return "empty";
      if (session.geometryValidation.validated) return "complete";
      return "partial";
    case "materialsLight":
      if (session.materialJustifications.length === 0 && !session.lighting) return "empty";
      if (session.materialJustifications.length > 0 && session.lighting) return "complete";
      return "partial";
    case "prompt":
      if (!session.promptFields) return "empty";
      return "complete";
    case "audit":
      if (!session.audit) return "empty";
      if (session.audit.alignsWellWithIntent.trim().length > 0) return "complete";
      return "partial";
    default:
      return "empty";
  }
}

export function getSkipDiagnostic(node: NodeId): string {
  const diagnostics: Record<NodeId, string> = {
    intent: "Intent is incomplete. Without a clear intent, subsequent visualization decisions lack an anchor for alignment.",
    visualPriority: "Visual priority is undefined. Identifying what deserves visualization helps focus material, lighting, and composition choices.",
    references: "References are missing. Analytical reference deconstruction strengthens deliberate visual borrowing in the final render.",
    geometry: "Geometry is not validated. Confirming your camera view ensures the render preserves your spatial intentions.",
    materialsLight: "Material and lighting logic is incomplete. These directly determine the visual quality and atmosphere of the render.",
    prompt: "Prompt architecture is incomplete. The structured prompt ensures your declared decisions translate accurately to the AI render.",
    audit: "Alignment audit is incomplete. Honest post-render reflection is where the deepest learning occurs.",
  };
  return diagnostics[node];
}

// --- App State ---

export interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  activeNode: NodeId;
  showExitSummary: NodeId | null;

  modelImage: UploadedImage | null;
  materialImages: UploadedImage[];
  referenceImages: UploadedImage[];
  sketchImages: UploadedImage[];

  prompt: string;
  aspectRatio: "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
  imageSize: "1K" | "2K" | "4K";
  geminiModel: GeminiModel;
  isRendering: boolean;
  renderProgress: number;
  renderResult: string | null;
  renderMimeType: string | null;
  renderError: string | null;

  history: RenderHistoryItem[];
}

export type AppAction =
  | { type: "CREATE_SESSION"; payload?: string }
  | { type: "DELETE_SESSION"; payload: string }
  | { type: "SET_ACTIVE_SESSION"; payload: string | null }
  | { type: "LOAD_SESSIONS"; payload: Session[] }
  | { type: "SET_ACTIVE_NODE"; payload: NodeId }
  | { type: "ADVANCE_NODE" }
  | { type: "SKIP_NODE"; payload: NodeId }
  | { type: "REFINE_RENDER" }
  | { type: "COMPLETE_SESSION" }
  | { type: "SHOW_EXIT_SUMMARY"; payload: NodeId | null }
  | { type: "SET_INTENT_DATA"; payload: IntentData }
  | { type: "SET_CONCEPT_CLARITY_SUMMARY"; payload: ConceptClaritySummary }
  | { type: "SET_VISUAL_PRIORITY_DATA"; payload: VisualPriorityData }
  | { type: "SET_MATERIAL_JUSTIFICATIONS"; payload: MaterialJustification[] }
  | { type: "SET_LIGHTING_DATA"; payload: LightingData }
  | { type: "SET_REFERENCE_BREAKDOWNS"; payload: ReferenceBreakdown[] }
  | { type: "SET_GEOMETRY_VALIDATION"; payload: GeometryValidationData }
  | { type: "SET_PROMPT_FIELDS"; payload: PromptFields }
  | { type: "SET_AUDIT_DATA"; payload: AuditData }
  | { type: "SAVE_NODE_REVISION"; payload: { nodeId: string; snapshot: unknown } }
  | { type: "SET_MODEL_IMAGE"; payload: UploadedImage | null }
  | { type: "UPDATE_MODEL_IMAGE"; payload: Partial<UploadedImage> }
  | { type: "ADD_MATERIAL_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_MATERIAL_IMAGE"; payload: string }
  | { type: "UPDATE_MATERIAL_IMAGE"; payload: { id: string } & Partial<UploadedImage> }
  | { type: "ADD_REFERENCE_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_REFERENCE_IMAGE"; payload: string }
  | { type: "UPDATE_REFERENCE_IMAGE"; payload: { id: string } & Partial<UploadedImage> }
  | { type: "ADD_SKETCH_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_SKETCH_IMAGE"; payload: string }
  | { type: "SET_PROMPT"; payload: string }
  | { type: "SET_ASPECT_RATIO"; payload: AppState["aspectRatio"] }
  | { type: "SET_IMAGE_SIZE"; payload: AppState["imageSize"] }
  | { type: "SET_GEMINI_MODEL"; payload: GeminiModel }
  | { type: "SET_RENDERING"; payload: boolean }
  | { type: "SET_RENDER_PROGRESS"; payload: number }
  | { type: "SET_RENDER_RESULT"; payload: { image: string; mimeType: string } | null }
  | { type: "SET_RENDER_ERROR"; payload: string | null }
  | { type: "CLEAR_RESULT" }
  | { type: "ADD_HISTORY_ITEM"; payload: RenderHistoryItem }
  | { type: "LOAD_HISTORY"; payload: RenderHistoryItem[] }
  | { type: "MOCK_FILL_SESSION" };

export const initialState: AppState = {
  sessions: [],
  activeSessionId: null,
  activeNode: "intent",
  showExitSummary: null,

  modelImage: null,
  materialImages: [],
  referenceImages: [],
  sketchImages: [],

  prompt: "",
  aspectRatio: "16:9",
  imageSize: "2K",
  geminiModel: "gemini-3.1-flash-image-preview",
  isRendering: false,
  renderProgress: 0,
  renderResult: null,
  renderMimeType: null,
  renderError: null,

  history: [],
};

function updateActiveSession(state: AppState, updater: (session: Session) => Session): AppState {
  if (!state.activeSessionId) return state;
  return {
    ...state,
    sessions: state.sessions.map((s) =>
      s.id === state.activeSessionId ? updater({ ...s, updatedAt: Date.now() }) : s
    ),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // --- Session management ---
    case "CREATE_SESSION": {
      const session = createEmptySession(action.payload);
      return {
        ...state,
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
        activeNode: "intent",
        showExitSummary: null,
        modelImage: null,
        materialImages: [],
        referenceImages: [],
        sketchImages: [],
        prompt: "",
        renderResult: null,
        renderMimeType: null,
        renderError: null,
        renderProgress: 0,
        isRendering: false,
      };
    }

    case "DELETE_SESSION":
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload),
        ...(state.activeSessionId === action.payload
          ? {
              activeSessionId: null,
              activeNode: "intent" as NodeId,
              showExitSummary: null,
              modelImage: null,
              materialImages: [],
              referenceImages: [],
              sketchImages: [],
              prompt: "",
              renderResult: null,
              renderMimeType: null,
              renderError: null,
            }
          : {}),
      };

    case "SET_ACTIVE_SESSION": {
      if (action.payload === null) {
        return {
          ...state,
          activeSessionId: null,
          activeNode: "intent",
          showExitSummary: null,
          modelImage: null,
          materialImages: [],
          referenceImages: [],
          sketchImages: [],
          prompt: "",
          renderResult: null,
          renderMimeType: null,
          renderError: null,
          renderProgress: 0,
        };
      }
      const session = state.sessions.find((s) => s.id === action.payload);
      if (!session) return state;
      return {
        ...state,
        activeSessionId: action.payload,
        activeNode: session.currentNode,
        showExitSummary: null,
        modelImage: null,
        materialImages: [],
        referenceImages: [],
        sketchImages: [],
        prompt: "",
        renderResult: null,
        renderMimeType: null,
        renderError: null,
        renderProgress: 0,
      };
    }

    case "LOAD_SESSIONS":
      return { ...state, sessions: action.payload };

    // --- Node navigation ---
    case "SET_ACTIVE_NODE": {
      return { ...state, activeNode: action.payload, showExitSummary: null };
    }

    case "ADVANCE_NODE": {
      const session = getActiveSession(state);
      if (!session) return state;
      const next = getNextNode(session.currentNode);
      if (!next) return state;
      return {
        ...updateActiveSession(state, (s) => ({ ...s, currentNode: next })),
        activeNode: next,
        showExitSummary: session.currentNode,
      };
    }

    case "SKIP_NODE": {
      const session = getActiveSession(state);
      if (!session) return state;
      const skippedNode = action.payload;
      const next = getNextNode(skippedNode);
      const newSkipped = session.skippedNodes.includes(skippedNode)
        ? session.skippedNodes
        : [...session.skippedNodes, skippedNode];
      const nextNode = next || session.currentNode;
      const advanceCurrent = NODE_ORDER.indexOf(nextNode) > NODE_ORDER.indexOf(session.currentNode);
      return {
        ...updateActiveSession(state, (s) => ({
          ...s,
          skippedNodes: newSkipped,
          ...(advanceCurrent ? { currentNode: nextNode } : {}),
        })),
        activeNode: nextNode,
        showExitSummary: skippedNode,
      };
    }

    case "REFINE_RENDER": {
      const session = getActiveSession(state);
      if (!session) return state;
      return {
        ...updateActiveSession(state, (s) => ({
          ...s,
          audit: s.audit ? { ...s.audit, refinementCount: s.audit.refinementCount + 1 } : null,
        })),
        activeNode: "prompt",
        showExitSummary: null,
        renderResult: null,
        renderMimeType: null,
        renderError: null,
        renderProgress: 0,
      };
    }

    case "COMPLETE_SESSION":
      return updateActiveSession(state, (s) => ({ ...s, completedAt: Date.now() }));

    case "SHOW_EXIT_SUMMARY":
      return { ...state, showExitSummary: action.payload };

    // --- Node data ---
    case "SET_INTENT_DATA":
      return updateActiveSession(state, (s) => ({ ...s, intent: action.payload }));

    case "SET_CONCEPT_CLARITY_SUMMARY":
      return updateActiveSession(state, (s) => ({ ...s, conceptClaritySummary: action.payload }));

    case "SET_VISUAL_PRIORITY_DATA":
      return updateActiveSession(state, (s) => ({ ...s, visualPriority: action.payload }));

    case "SET_MATERIAL_JUSTIFICATIONS":
      return updateActiveSession(state, (s) => ({ ...s, materialJustifications: action.payload }));

    case "SET_LIGHTING_DATA":
      return updateActiveSession(state, (s) => ({ ...s, lighting: action.payload }));

    case "SET_REFERENCE_BREAKDOWNS":
      return updateActiveSession(state, (s) => ({ ...s, referenceBreakdowns: action.payload }));

    case "SET_GEOMETRY_VALIDATION":
      return updateActiveSession(state, (s) => ({ ...s, geometryValidation: action.payload }));

    case "SET_PROMPT_FIELDS":
      return updateActiveSession(state, (s) => ({ ...s, promptFields: action.payload }));

    case "SET_AUDIT_DATA":
      return updateActiveSession(state, (s) => ({ ...s, audit: action.payload }));

    case "SAVE_NODE_REVISION":
      return updateActiveSession(state, (s) => {
        const revisions = { ...s.nodeRevisions };
        const key = action.payload.nodeId;
        revisions[key] = [...(revisions[key] || []), { timestamp: Date.now(), snapshot: action.payload.snapshot }];
        return { ...s, nodeRevisions: revisions };
      });

    // --- Images ---
    case "SET_MODEL_IMAGE":
      return { ...state, modelImage: action.payload };
    case "UPDATE_MODEL_IMAGE":
      return state.modelImage
        ? { ...state, modelImage: { ...state.modelImage, ...action.payload } }
        : state;
    case "ADD_MATERIAL_IMAGE":
      return { ...state, materialImages: [...state.materialImages, action.payload] };
    case "REMOVE_MATERIAL_IMAGE":
      return { ...state, materialImages: state.materialImages.filter((i) => i.id !== action.payload) };
    case "UPDATE_MATERIAL_IMAGE":
      return {
        ...state,
        materialImages: state.materialImages.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload } : i
        ),
      };
    case "ADD_REFERENCE_IMAGE":
      return { ...state, referenceImages: [...state.referenceImages, action.payload] };
    case "REMOVE_REFERENCE_IMAGE":
      return { ...state, referenceImages: state.referenceImages.filter((i) => i.id !== action.payload) };
    case "UPDATE_REFERENCE_IMAGE":
      return {
        ...state,
        referenceImages: state.referenceImages.map((i) =>
          i.id === action.payload.id ? { ...i, ...action.payload } : i
        ),
      };
    case "ADD_SKETCH_IMAGE":
      return { ...state, sketchImages: [...state.sketchImages, action.payload] };
    case "REMOVE_SKETCH_IMAGE":
      return { ...state, sketchImages: state.sketchImages.filter((i) => i.id !== action.payload) };

    // --- Render config ---
    case "SET_PROMPT":
      return { ...state, prompt: action.payload };
    case "SET_ASPECT_RATIO":
      return { ...state, aspectRatio: action.payload };
    case "SET_IMAGE_SIZE":
      return { ...state, imageSize: action.payload };
    case "SET_GEMINI_MODEL":
      return { ...state, geminiModel: action.payload };

    // --- Render state ---
    case "SET_RENDERING":
      return { ...state, isRendering: action.payload };
    case "SET_RENDER_PROGRESS":
      return { ...state, renderProgress: action.payload };
    case "SET_RENDER_RESULT":
      return action.payload
        ? { ...state, renderResult: action.payload.image, renderMimeType: action.payload.mimeType }
        : { ...state, renderResult: null, renderMimeType: null };
    case "SET_RENDER_ERROR":
      return { ...state, renderError: action.payload };
    case "CLEAR_RESULT":
      return { ...state, renderResult: null, renderMimeType: null, renderError: null, renderProgress: 0 };

    // --- History ---
    case "ADD_HISTORY_ITEM":
      return { ...state, history: [action.payload, ...state.history] };
    case "LOAD_HISTORY":
      return { ...state, history: action.payload };

    case "MOCK_FILL_SESSION": {
      const s = getActiveSession(state);
      if (!s) return state;
      return {
        ...updateActiveSession(state, (sess) => ({
          ...sess,
          currentNode: "prompt" as NodeId,
          intent: {
            conceptStatement:
              "A contemplative co-working space that blurs the boundary between interior and landscape, using rammed-earth walls and diffused zenithal light to create an atmosphere of focused calm.",
            targetUser:
              "Freelance designers and writers seeking a distraction-free environment that still feels connected to the outdoors.",
            spatialGoal:
              "Guide the occupant's gaze from the tactile earth wall surface, across the long communal table, toward the framed garden view — reinforcing a rhythm of focus and release.",
            emotionalAtmosphere:
              "Quiet intensity — warm, grounded, and slightly monastic without feeling austere.",
            behaviorReinforcement:
              "The narrow field of view and low ambient light encourage deep work, while the single panoramic opening offers periodic visual rest.",
            imageType: "atmospheric",
            intentStatement:
              "This visualization captures the moment when late-afternoon light washes across the rammed-earth wall, casting long soft shadows over the workspace and pulling the viewer's attention toward the garden threshold — embodying the project's core idea that productive solitude and natural presence can coexist.",
            socraticResponses: {
              spatialMechanism:
                "The rammed-earth wall acts as a thermal and visual anchor; its layered texture slows the eye and grounds the occupant before the panoramic opening releases their gaze into the landscape.",
              visualMoment:
                "Late afternoon, when a single beam of zenithal light grazes the earth wall and spills warm color across the communal table.",
              oppositeDescription:
                "A bright, white-walled open-plan office with uniform fluorescent lighting and floor-to-ceiling glass on all sides — stimulating but relentless.",
              failureScenario:
                "If the visualization fails, the space would read as a dim, cave-like room rather than a luminous retreat — losing the duality of enclosure and openness.",
            },
          },
          visualPriority: {
            primaryFocusArea:
              "The textured rammed-earth wall catching zenithal light, revealing the horizontal strata of pigmented soil layers.",
            secondaryFocusArea:
              "The communal timber table surface with scattered work tools, creating a sense of inhabitation.",
            sequenceThreshold:
              "Wall texture → table surface → garden view through the panoramic slot — a three-beat rhythm from near to far.",
            visualizationTarget:
              "The interplay between the warm, rough earth wall and the cool, soft garden light entering through the horizontal opening — the exact spatial tension that defines this project.",
            sketchBase64: null,
            sketchFeedback: null,
          },
          referenceBreakdowns: [
            {
              id: crypto.randomUUID(),
              lens: "Wide establishing shot, 24mm equivalent, slight upward tilt to emphasize wall height",
              framing: "Two-thirds earth wall on the left, one-third garden opening on the right, table anchoring the lower third",
              tone: "Warm mid-tones with muted highlights — amber cast from the earth, cooled by reflected garden light",
              grain: "Fine grain, almost imperceptible — clean enough to read material texture without adding noise",
              colorTemperature: "Mixed: warm 3200K from the wall reflections, neutral 5500K from the garden daylight",
              notBorrowing: "Not borrowing the dramatic chiaroscuro or the high-contrast silhouettes — this space requires gentler, more diffused light.",
              emotion: "Contemplative stillness — the feeling of being sheltered while remaining aware of the world outside",
              borrowingCategories: ["Lighting", "Material palette", "Spatial hierarchy"],
            },
          ],
          geometryValidation: {
            cameraRelationship: "similar",
            cameraJustification:
              "The camera matches the reference's wide-angle perspective and low horizon line, preserving the spatial hierarchy of wall-table-garden that is central to the design concept.",
            validated: true,
          },
          materialJustifications: [
            {
              id: crypto.randomUUID(),
              materialName: "Rammed Earth Wall",
              whyForUser:
                "The layered earth surface provides a tactile, handcrafted quality that signals permanence and care — qualities the target user (focused creative workers) associates with intentional craft.",
              tactileQuality:
                "Coarse and stratified with visible aggregate. Cool to the touch. Horizontal striations create a geological rhythm.",
              lightBehavior:
                "Absorbs most direct light and scatters it warmly; highlights the grain at grazing angles; deepens to rich sienna in shadow.",
              culturalCoherence:
                "Rammed earth has a long vernacular history in arid climates — it signals locality and ecological responsibility.",
              conceptReinforcement:
                "The wall's mass and texture embody the project's theme of grounded focus — heavy, stable, and warm.",
              zone: "Primary wall — west-facing interior surface, floor to ceiling",
            },
            {
              id: crypto.randomUUID(),
              materialName: "Oiled Timber Tabletop",
              whyForUser:
                "Timber offers a warm, forgiving work surface. The oil finish invites touch without feeling precious — supporting the idea that this space is for real, sustained work.",
              tactileQuality:
                "Smooth with visible open grain. Slightly warm underhand. Develops a gentle patina over time.",
              lightBehavior:
                "Low-sheen reflection; picks up warm overhead light and distributes it softly; grain catches side light.",
              culturalCoherence:
                "Solid timber tables reference communal dining and workshop traditions — signals shared endeavor.",
              conceptReinforcement:
                "The table is the social and functional heart of the space. Its warmth and scale reinforce collectivity within a quiet atmosphere.",
              zone: "Central communal table — runs the full length of the room",
            },
          ],
          lighting: {
            timeOfDay: "Late afternoon, approximately 16:30",
            lightSource: "natural",
            contrastLevel:
              "Moderate — the zenithal slot creates one strong highlight band across the wall, but the rest of the space is gently ambient.",
            shadowIntention:
              "Long, soft-edged shadows from the table objects stretching toward the viewer, emphasizing depth and time of day.",
            moodProduced:
              "Warm, contemplative, and quietly dramatic — the single light source creates a sense of event without overwhelming the calm.",
            preset: "golden-hour",
          },
          promptFields: {
            lens: "24mm wide-angle",
            lighting: "Late-afternoon zenithal light, warm golden-hour tone, single beam grazing the rammed-earth wall",
            materials: "Rammed earth with visible strata, oiled timber tabletop with open grain, polished concrete floor",
            cameraHeight: "Seated eye level, approximately 1.1m",
            mood: "Contemplative, warm, quietly dramatic — focused calm with a sense of natural presence",
            composition: "Earth wall anchoring left two-thirds, panoramic garden slot on the right, communal table in the lower third",
            resolution: "4K",
          },
        })),
        activeNode: "prompt",
      };
    }

    default:
      return state;
  }
}

// --- Context ---

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

export function useApp() {
  return useContext(AppContext);
}

// --- Persistence ---

const SESSIONS_KEY = "cn_sessions_v2";
const HISTORY_KEY = "render_history";

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

export function loadHistory(): RenderHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: RenderHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  } catch {}
}

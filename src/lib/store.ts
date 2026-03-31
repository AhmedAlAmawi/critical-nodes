"use client";

import { createContext, useContext } from "react";

// --- Node Types ---

export type NodeId = "intent" | "materials" | "lighting" | "references" | "prompt" | "audit";

export const NODE_ORDER: NodeId[] = ["intent", "materials", "lighting", "references", "prompt", "audit"];

export const NODE_LABELS: Record<NodeId, string> = {
  intent: "Intent Definition",
  materials: "Material Logic",
  lighting: "Light & Atmosphere",
  references: "Reference Deconstruction",
  prompt: "Prompt Architecture",
  audit: "Alignment Audit",
};

export const NODE_DESCRIPTIONS: Record<NodeId, string> = {
  intent: "Define the foundational intent of this visualization. Every subsequent decision is validated against the intent created here.",
  materials: "Justify every material choice. No aesthetic-only answers — connect each material to the user, the concept, and the light.",
  lighting: "Control the atmosphere deliberately. Choose lighting that reinforces the emotional intent of the space.",
  references: "Deconstruct your references analytically. Identify exactly what you are borrowing — and what you are not.",
  prompt: "Construct the prompt using structured fields. Upload your model, configure output, and generate.",
  audit: "Validate the render against your declared intent. Identify mismatches and refine if needed.",
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

export interface IntentData {
  conceptStatement: string;
  targetUser: string;
  spatialGoal: string;
  emotionalAtmosphere: string;
  behaviorReinforcement: string;
  imageType: "documentary" | "atmospheric" | "material-focused" | "narrative" | "";
  intentStatement: string;
}

export interface MaterialJustification {
  id: string;
  materialName: string;
  whyForUser: string;
  tactileQuality: string;
  lightBehavior: string;
  culturalCoherence: string;
  conceptReinforcement: string;
}

export interface LightingData {
  timeOfDay: string;
  lightSource: "natural" | "artificial" | "mixed" | "";
  contrastLevel: string;
  shadowIntention: string;
  moodProduced: string;
  preset: "overcast" | "golden-hour" | "high-contrast" | "flat-documentary" | "custom" | "";
}

export interface ReferenceBreakdown {
  id: string;
  lens: string;
  framing: string;
  tone: string;
  grain: string;
  colorTemperature: string;
  notBorrowing: string;
  emotion: string;
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
  intentCommunicated: boolean | null;
  focalHierarchy: string;
  materialRealism: boolean | null;
  lightingContradiction: boolean | null;
  accidentalElements: string;
  mismatches: [string, string, string];
  refined: boolean;
}

// --- Session Type ---

export interface Session {
  id: string;
  name: string;
  currentNode: NodeId;
  intent: IntentData | null;
  materialJustifications: MaterialJustification[];
  lighting: LightingData | null;
  referenceBreakdowns: ReferenceBreakdown[];
  promptFields: PromptFields | null;
  audit: AuditData | null;
  renderThumbnail: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

// --- Helpers ---

export function canAccessNode(session: Session | null, targetNode: NodeId): boolean {
  if (!session) return false;
  return NODE_ORDER.indexOf(targetNode) <= NODE_ORDER.indexOf(session.currentNode);
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
    materialJustifications: [],
    lighting: null,
    referenceBreakdowns: [],
    promptFields: null,
    audit: null,
    renderThumbnail: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
  };
}

export function isNodeComplete(session: Session, node: NodeId): boolean {
  const nodeIdx = NODE_ORDER.indexOf(node);
  const currentIdx = NODE_ORDER.indexOf(session.currentNode);
  return nodeIdx < currentIdx;
}

// --- App State ---

export interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  activeNode: NodeId;

  modelImage: UploadedImage | null;
  materialImages: UploadedImage[];
  referenceImages: UploadedImage[];

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
  | { type: "REFINE_RENDER" }
  | { type: "COMPLETE_SESSION" }
  | { type: "SET_INTENT_DATA"; payload: IntentData }
  | { type: "SET_MATERIAL_JUSTIFICATIONS"; payload: MaterialJustification[] }
  | { type: "SET_LIGHTING_DATA"; payload: LightingData }
  | { type: "SET_REFERENCE_BREAKDOWNS"; payload: ReferenceBreakdown[] }
  | { type: "SET_PROMPT_FIELDS"; payload: PromptFields }
  | { type: "SET_AUDIT_DATA"; payload: AuditData }
  | { type: "SET_MODEL_IMAGE"; payload: UploadedImage | null }
  | { type: "UPDATE_MODEL_IMAGE"; payload: Partial<UploadedImage> }
  | { type: "ADD_MATERIAL_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_MATERIAL_IMAGE"; payload: string }
  | { type: "UPDATE_MATERIAL_IMAGE"; payload: { id: string } & Partial<UploadedImage> }
  | { type: "ADD_REFERENCE_IMAGE"; payload: UploadedImage }
  | { type: "REMOVE_REFERENCE_IMAGE"; payload: string }
  | { type: "UPDATE_REFERENCE_IMAGE"; payload: { id: string } & Partial<UploadedImage> }
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
  | { type: "LOAD_HISTORY"; payload: RenderHistoryItem[] };

export const initialState: AppState = {
  sessions: [],
  activeSessionId: null,
  activeNode: "intent",

  modelImage: null,
  materialImages: [],
  referenceImages: [],

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
        modelImage: null,
        materialImages: [],
        referenceImages: [],
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
              modelImage: null,
              materialImages: [],
              referenceImages: [],
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
          modelImage: null,
          materialImages: [],
          referenceImages: [],
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
        modelImage: null,
        materialImages: [],
        referenceImages: [],
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
      const session = getActiveSession(state);
      if (!session || !canAccessNode(session, action.payload)) return state;
      return { ...state, activeNode: action.payload };
    }

    case "ADVANCE_NODE": {
      const session = getActiveSession(state);
      if (!session) return state;
      const next = getNextNode(session.currentNode);
      if (!next) return state;
      return {
        ...updateActiveSession(state, (s) => ({ ...s, currentNode: next })),
        activeNode: next,
      };
    }

    case "REFINE_RENDER": {
      const session = getActiveSession(state);
      if (!session || session.currentNode !== "audit") return state;
      return {
        ...updateActiveSession(state, (s) => ({
          ...s,
          audit: s.audit ? { ...s.audit, refined: true } : null,
        })),
        activeNode: "prompt",
        renderResult: null,
        renderMimeType: null,
        renderError: null,
        renderProgress: 0,
      };
    }

    case "COMPLETE_SESSION":
      return updateActiveSession(state, (s) => ({ ...s, completedAt: Date.now() }));

    // --- Node data ---
    case "SET_INTENT_DATA":
      return updateActiveSession(state, (s) => ({ ...s, intent: action.payload }));

    case "SET_MATERIAL_JUSTIFICATIONS":
      return updateActiveSession(state, (s) => ({ ...s, materialJustifications: action.payload }));

    case "SET_LIGHTING_DATA":
      return updateActiveSession(state, (s) => ({ ...s, lighting: action.payload }));

    case "SET_REFERENCE_BREAKDOWNS":
      return updateActiveSession(state, (s) => ({ ...s, referenceBreakdowns: action.payload }));

    case "SET_PROMPT_FIELDS":
      return updateActiveSession(state, (s) => ({ ...s, promptFields: action.payload }));

    case "SET_AUDIT_DATA":
      return updateActiveSession(state, (s) => ({ ...s, audit: action.payload }));

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

const SESSIONS_KEY = "cn_sessions";
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
